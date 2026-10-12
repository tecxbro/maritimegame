#!/usr/bin/env python3
"""Bake this static authored GLB into material-grouped runtime geometry."""
import argparse, json, struct
from pathlib import Path
import numpy as np

TYPES = {5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
WIDTH = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}

def convert(source, destination):
    raw = Path(source).read_bytes()
    magic, version, length = struct.unpack_from('<4sII', raw)
    assert magic == b'glTF' and version == 2 and length == len(raw)
    chunks = {}; offset = 12
    while offset < length:
        size, kind = struct.unpack_from('<II',raw,offset); offset += 8
        chunks[kind] = raw[offset:offset+size]; offset += size
    doc = json.loads(chunks[0x4E4F534A]); binary = chunks[0x004E4942]
    assert not doc.get('animations') and not doc.get('skins')
    assert not doc.get('textures'), 'Texture material attributes require a richer runtime schema'
    def accessor(index):
        a = doc['accessors'][index]; assert 'sparse' not in a
        view = doc['bufferViews'][a['bufferView']]; assert view.get('buffer',0) == 0
        dtype = np.dtype(TYPES[a['componentType']]); width = WIDTH[a['type']]
        result = np.ndarray((a['count'],width),dtype=dtype,buffer=binary,
             offset=view.get('byteOffset',0)+a.get('byteOffset',0),
             strides=(view.get('byteStride',dtype.itemsize*width),dtype.itemsize)).copy()
        if a.get('normalized'):
            info = np.iinfo(dtype); result = np.maximum(result.astype(float)/info.max,-1)
        return result
    def matrix(node):
        if 'matrix' in node: return np.array(node['matrix']).reshape(4,4,order='F')
        x,y,z,w = node.get('rotation',[0,0,0,1]); q = np.array([x,y,z,w],dtype=float)
        q /= np.linalg.norm(q); x,y,z,w = q
        rot = np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
                        [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
                        [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
        m = np.eye(4); m[:3,:3] = rot @ np.diag(node.get('scale',[1,1,1]))
        m[:3,3] = node.get('translation',[0,0,0]); return m
    materials = []
    for mat in doc['materials']:
        p = mat.get('pbrMetallicRoughness',{}); rgba = p.get('baseColorFactor',[1,1,1,1])
        assert rgba[3] == 1 and mat.get('alphaMode','OPAQUE') == 'OPAQUE'
        materials.append(dict(name=mat.get('name',''),color=rgba[:3],metalness=p.get('metallicFactor',1),roughness=p.get('roughnessFactor',1)))
    groups = {i:dict(material=i,positions=[],normals=[],indices=[]) for i in range(len(materials))}
    anchors = {}; mesh_nodes = []; primitive_count = 0; input_vertices = 0; input_triangles = 0
    def visit(index,parent,ancestors):
        nonlocal primitive_count,input_vertices,input_triangles
        assert index not in ancestors, 'Node cycle'
        node = doc['nodes'][index]; world = parent @ matrix(node)
        if node.get('name','').startswith('ANCHOR_'): anchors[node['name']] = world[:3,3].tolist()
        if 'mesh' in node:
            mesh_nodes.append(index)
            for prim in doc['meshes'][node['mesh']]['primitives']:
                assert prim.get('mode',4) == 4 and not prim.get('targets')
                p = accessor(prim['attributes']['POSITION']).astype(float)
                n = accessor(prim['attributes']['NORMAL']).astype(float)
                i = accessor(prim['indices']).reshape(-1).astype(np.int64) if 'indices' in prim else np.arange(len(p))
                assert p.shape == n.shape and p.shape[1] == 3 and len(i)%3 == 0
                assert i.min() >= 0 and i.max() < len(p)
                transformed = p @ world[:3,:3].T + world[:3,3]
                normals = n @ np.linalg.inv(world[:3,:3])
                norms = np.linalg.norm(normals,axis=1); assert (norms > 1e-10).all()
                normals /= norms[:,None]
                if np.linalg.det(world[:3,:3]) < 0: i = i.reshape(-1,3)[:,[0,2,1]].reshape(-1)
                assert np.isfinite(transformed).all() and np.isfinite(normals).all()
                group = groups[prim['material']]; base = len(group['positions'])//3
                group['positions'].extend(transformed.ravel().tolist()); group['normals'].extend(normals.ravel().tolist())
                group['indices'].extend((i+base).tolist())
                primitive_count += 1; input_vertices += len(p); input_triangles += len(i)//3
        for child in node.get('children',[]): visit(child,world,ancestors | {index})
    for node in doc['scenes'][doc.get('scene',0)]['nodes']: visit(node,np.eye(4),set())
    # This authored asset is one static scene; require every mesh instance to survive.
    expected_nodes = [i for i,n in enumerate(doc['nodes']) if 'mesh' in n]
    assert sorted(mesh_nodes) == expected_nodes
    parts = [g for g in groups.values() if g['positions']]
    payload = dict(materials=materials,parts=parts)
    out = Path(destination); out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(payload,separators=(',',':'),allow_nan=False)+'\n')
    # Validate the actual serialized file, including totals and bounds.
    loaded = json.loads(out.read_text()); total_vertices = total_triangles = 0; positions = []; norm_error = 0
    for part in loaded['parts']:
        p = np.array(part['positions']).reshape(-1,3); n = np.array(part['normals']).reshape(-1,3); i = np.array(part['indices'])
        assert p.shape == n.shape and np.isfinite(p).all() and np.isfinite(n).all()
        assert len(i)%3 == 0 and i.min() >= 0 and i.max() < len(p)
        error = float(np.max(np.abs(np.linalg.norm(n,axis=1)-1))); assert error < 1e-12
        norm_error = max(norm_error,error); positions.append(p); total_vertices += len(p); total_triangles += len(i)//3
    assert total_vertices == input_vertices and total_triangles == input_triangles
    p = np.concatenate(positions)
    report = dict(source=str(source),output=str(out),meshNodes=len(mesh_nodes),sourcePrimitives=primitive_count,
        runtimeParts=len(parts),vertices=total_vertices,triangles=total_triangles,
        boundsMin=p.min(axis=0).tolist(),boundsMax=p.max(axis=0).tolist(),
        boundsSize=np.ptp(p,axis=0).tolist(),anchors=anchors,maxNormalLengthError=norm_error,
        bytes=out.stat().st_size,coordinateSystem='glTF: -Z forward, +Y up; no axis conversion',
        sourceCameras=len(doc.get('cameras',[])),sourceLights=len(doc.get('extensions',{}).get('KHR_lights_punctual',{}).get('lights',[])))
    out.with_name('validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__ == '__main__':
    p=argparse.ArgumentParser(); p.add_argument('source'); p.add_argument('destination'); a=p.parse_args()
    convert(a.source,a.destination)
