import bpy, math, json, os
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
OUT=os.environ.get('BOAT_ASSET_OUTPUT', os.path.dirname(os.path.abspath(__file__)))
os.makedirs(OUT+'/renders',exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for d in bpy.data.materials: bpy.data.materials.remove(d)
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.samples=96
scene.cycles.use_denoising=False
scene.render.resolution_x=768; scene.render.resolution_y=512; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'; scene.render.film_transparent=True
scene.world.color=(.5,.6,.75)
scene.view_settings.view_transform='Standard'; scene.view_settings.look='Medium High Contrast'; scene.view_settings.exposure=-0.7; scene.view_settings.gamma=1
scene.render.image_settings.color_depth='8'
scene.world.use_nodes=True; scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.57,.68,.86,1); scene.world.node_tree.nodes['Background'].inputs[1].default_value=.32

def mat(name, color, rough=.42, metal=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
 return m
paint=mat('01 Sunburst yellow | player',(1,.62,.003),.31,.12)
edge=mat('02 Warm golden hull bevel',(.69,.35,.012),.36,.08)
spine=mat('03 Electric lime spine',(.018,.58,.004),.34,.10)
spineEdge=mat('04 Lime bevel',(.075,.37,.012),.4,.08)
white=mat('05 Ivory speed graphics',(.97,.98,.77),.35,.05)
black=mat('06 Graphite rubber trim',(.015,.027,.033),.68)
carbon=mat('07 Carbon inset',(.027,.048,.057),.58,.15)
steel=mat('08 Satin alloy stern',(.29,.40,.47),.29,.75)
brightSteel=mat('09 Edge alloy',(.52,.66,.70),.28,.65)
glass=mat('10 Smoke cyan windshield',(.025,.17,.19),.21,.35)
seatmat=mat('11 Dark cockpit upholstery',(.055,.075,.075),.82)
accent=mat('12 Acid livery accent',(.76,1,.04),.35)
materials=[paint,edge,spine,spineEdge,white,black,carbon,steel,brightSteel,glass,seatmat,accent]
boat=bpy.data.objects.new('SUNFISH_07 | original arcade hydroplane',None); scene.collection.objects.link(boat)

def mesh(name,verts,faces,mats,ids=None):
 me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.materials.clear()
 for m in mats: me.materials.append(m)
 me.update(); ob=bpy.data.objects.new(name,me); scene.collection.objects.link(ob); ob.parent=boat
 if ids:
  for p,i in zip(me.polygons,ids): p.material_index=i
 return ob

def loft(name,sections,matset,ids=None):
 # rings of x,z points at each y
 v=[]
 for y,pts in sections: v.extend([(x,y,z) for x,z in pts])
 n=len(sections[0][1]); fs=[]; mi=[]
 fs.append(tuple(range(n-1,-1,-1))); mi.append(0)
 for k in range(len(sections)-1):
  for j in range(n): fs.append((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j)); mi.append(ids[j] if ids else 0)
 fs.append(tuple((len(sections)-1)*n+j for j in range(n))); mi.append(0)
 return mesh(name,v,fs,matset,mi)

def solid_poly(name,points,z0,z1,matl,bevel=0):
 # x/y planar footprint
 verts=[(x,y,z0) for x,y in points]+[(x,y,z1) for x,y in points]; n=len(points)
 faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 ob=mesh(name,verts,faces,[matl])
 if bevel:
  mod=ob.modifiers.new('Small manufactured edge radii','BEVEL'); mod.width=bevel; mod.segments=2
  mod=ob.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return ob

def cube(name,loc,scale,ma,bevel=.025):
 bpy.ops.mesh.primitive_cube_add(size=1, location=loc); ob=bpy.context.object; ob.name=name; ob.dimensions=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); ob.data.materials.append(ma); ob.parent=boat
 if bevel:
  mod=ob.modifiers.new('Beveled edges','BEVEL'); mod.width=bevel; mod.segments=2
  ob.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
 return ob

def tube(name,a,b,r,ma,vertices=12):
 p=Vector(a); q=Vector(b); direction=q-p
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=r, depth=direction.length, location=(p+q)/2)
 ob=bpy.context.object; ob.name=name; ob.rotation_euler=direction.to_track_quat('Z','Y').to_euler(); ob.data.materials.append(ma); ob.parent=boat
 return ob
# A stepped vee-bottom formed from deliberate chine sections, never a box.
base_sections=[]
for y,w,top,bottom in [(-2.35,1.32,.31,.00),(-1.6,1.48,.34,-.07),(.25,1.38,.35,-.10),(1.7,.97,.39,-.04),(2.65,.54,.43,.13),(3.45,.065,.46,.35)]:
 base_sections.append((y,[(-w*.86,bottom),(-w,.20),(-w,top),(w,top),(w,.20),(w*.86,bottom),(0,bottom-.12)]))
loft('Chined dark underbody',base_sections,[black,carbon],[0,0,1,0,0,0,0])
# Continuous yellow shoulder decks, lifted at the bow and scalloped toward center.
for sign,label in [(-1,'PORT'),(1,'STARBOARD')]:
 sections=[]
 for y,inner,outer,z in [(-2.35,.51,1.32,.47),(-1.7,.49,1.48,.57),(-.1,.50,1.43,.66),(1.25,.44,1.12,.73),(2.40,.26,.65,.73),(3.45,.012,.075,.51)]:
  pts=[(sign*inner,.31),(sign*outer,.30),(sign*(outer+.005),z-.15),(sign*(outer-.09),z),(sign*(inner+.065),z+.04),(sign*inner,z-.055)]
  if sign<0: pts=pts[::-1]
  sections.append((y,pts))
 # mesh face material assignments: top yellow with darker side bevel.
 ob=loft(label+' sculpted yellow sponson',sections,[paint,edge],[1,1,0,0,0,1] if sign>0 else [0,0,1,1,1,0])
 # black chine line on the outside, separate from yellow deck.
 sec=[]
 for y,w,z in [(-2.35,1.325,.32),(-1.7,1.485,.35),(-.1,1.435,.36),(1.25,1.13,.40),(2.40,.655,.43),(3.40,.087,.465)]:
  sec.append((y,[(sign*(w-.035),z-.015),(sign*(w+.012),z-.005),(sign*(w+.008),z+.075),(sign*(w-.035),z+.065)]))
 loft(label+' continuous rubber rub rail',sec,[black])
# Sloping lime front spine, narrowing to the common sharp bow.
loft('Raised lime foredeck',[(.72,[(-.47,.48),(-.47,.75),(0,.85),(.47,.75),(.47,.48)]),(1.36,[(-.43,.53),(-.43,.79),(0,.89),(.43,.79),(.43,.53)]),(2.4,[(-.26,.53),(-.26,.77),(0,.87),(.26,.77),(.26,.53)]),(3.47,[(-.022,.42),(-.022,.49),(0,.53),(.022,.49),(.022,.42)])],[spine,spineEdge],[1,0,0,1,1])
# Rear lime spine separates cockpit and twin drives.
loft('Lime rear engine cowling',[(-2.33,[(-.52,.31),(-.49,.60),(0,.66),(.49,.60),(.52,.31)]),(-1.50,[(-.53,.31),(-.49,.73),(0,.78),(.49,.73),(.53,.31)]),(-.91,[(-.51,.32),(-.48,.72),(0,.76),(.48,.72),(.51,.32)])],[spine,spineEdge],[1,0,0,1,1])
# Open inset cockpit: a real recessed well and independent raised lip.
solid_poly('Recessed cockpit floor',[(-.47,-.94),(.47,-.94),(.47,.74),(-.47,.74)],.26,.32,carbon)
for sign,label in [(-1,'PORT'),(1,'STARBOARD')]:
 solid_poly(label+' cockpit coaming',[(sign*.45,-1.01),(sign*.58,-.87),(sign*.57,.70),(sign*.43,.85)],.39,.72,spineEdge,.035)
 tube(label+' cockpit lip',(sign*.485,-.90,.73),(sign*.485,.66,.73),.038,black)
# Seat cushion and angled seat back stay below the rider-overlay waist anchor.
seat=cube('Deep bucket seat cushion',(0,-.45,.37),(.72,.68,.14),seatmat,.075)
back=cube('Low cockpit seat back',(0,-.79,.57),(.70,.16,.53),seatmat,.065); back.rotation_euler.x=math.radians(-10)
for sx in [-.30,.30]: cube('Seat cushion seam',(sx,-.42,.45),(.012,.51,.012),steel,.003)
# Console and low windshield are forward of the rider.
console=cube('Cockpit front console',(0,.62,.48),(.82,.21,.31),carbon,.03)
solid_poly('Small angled smoke windscreen',[(-.45,.73),(.45,.73),(.36,1.03),(-.36,1.03)],.70,.85,glass,.018)
tube('Windscreen top frame',(-.40,.74,.86),(.40,.74,.86),.022,black)
# Steering wheel, an understated tiny ring angled toward seat.
bpy.ops.mesh.primitive_torus_add(major_radius=.16,minor_radius=.022,major_segments=16,minor_segments=6,location=(0,.45,.60),rotation=(math.radians(58),0,0))
ob=bpy.context.object; ob.name='Cockpit steering wheel'; ob.data.materials.append(black); ob.parent=boat
tube('Steering column',(0,.54,.41),(0,.45,.60),.025,steel)
# Twin separated stern hydrojet rails, no central fused engine block.
for sign,label in [(-1,'PORT'),(1,'STARBOARD')]:
 x=sign*.86
 rail=cube(label+' separate stern drive casing',(x,-2.62,.24),(.52,1.26,.35),steel,.065)
 cube(label+' black foot under stern drive',(x,-2.77,.03),(.53,1.06,.17),black,.045)
 cube(label+' stern drive top panel',(x,-2.59,.427),(.39,1.00,.023),carbon,.018)
 for j in range(4): cube(label+' transverse stern grip '+str(j),(x,-2.97+j*.23,.45),(.43,.055,.038),brightSteel,.012)
 # Rear dark waterjet mouth.
 tube(label+' jet nozzle',(x,-3.20,.20),(x,-3.29,.20),.14,black)
 tube(label+' nozzle throat',(x,-3.296,.20),(x,-3.299,.20),.087,carbon)
 # Bolts provide enough shape detail in close pre-race view.
 for dx in [-.20,.20]:
  for yy in [-3.08,-2.11]:
   bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=.025,location=(x+dx,yy,.44)); ob=bpy.context.object; ob.name=label+' alloy fastener'; ob.data.materials.append(brightSteel); ob.parent=boat
# Engine grille inset on rear lime spine. Each slat follows the rising cover.
for j in range(4):
 y=-2.00+j*.19; z=.72+(.03 if j>1 else 0)
 cube('Rear cowling vent '+str(j),(0,y,z),(.66-.025*j,.084,.018),carbon,.011)
# Original geometric livery, designed to remain legible at sprite sizes.
for sign,label in [(-1,'PORT'),(1,'STARBOARD')]:
 # rear arrow band on wide yellow shoulder
 pts=[(sign*.68,-1.71),(sign*1.36,-1.46),(sign*1.38,-1.20),(sign*.68,-1.47)]
 solid_poly(label+' ivory rear speed chevron',pts,.621,.633,white)
 # shoulder black diagonals (not copied source markings)
 for j in range(3):
  y=.61+j*.20
  pts=[(sign*.65,y),(sign*(1.25-.10*j),y+.14),(sign*(1.20-.10*j),y+.22),(sign*.63,y+.075)]
  solid_poly(label+' dark shoulder slash '+str(j),pts,.756,.764,carbon)
 # outside lower ivory stripe
 tube(label+' ivory outer accent',(sign*1.405,-.95,.442),(sign*1.46,-1.58,.425),.023,white,8)
# Thin dark arrow graphic running down the nose ridge.
mesh('Foredeck spear graphic',[(0,3.22,.578),(-.078,2.85,.737),(0,2.98,.746),(.078,2.85,.737)],[(0,1,2),(0,2,3)],[white])
# Non-brand original race number on side-deck planar patch.
for sign,label in [(-1,'PORT'),(1,'STARBOARD')]:
 cu=bpy.data.curves.new(label+' race number','FONT'); cu.body='07'; cu.align_x='CENTER'; cu.align_y='CENTER'; cu.size=.27; cu.extrude=.001; cu.space_character=1.05
 ob=bpy.data.objects.new(label+' race number 07',cu); scene.collection.objects.link(ob); ob.location=(sign*.95,-.69,.713); ob.data.materials.append(carbon); ob.parent=boat
 # Text default lies in its XY plane, intentionally on the top deck.
# Navigation light details, inset so they do not change silhouette.
for x,ma in [(-1.20,accent),(1.20,white)]: cube('Shoulder running light',(x,-1.99,.586),(.10,.19,.025),ma,.018)
# Named empties exported as stable boat-space anchors.
anchors={'seat':(0,-.45,.76),'bow':(0,3.47,.48),'stern':(0,-3.17,.06),'sternLeft':(-.86,-3.22,.06),'sternRight':(.86,-3.22,.06),'waterline':(0,-.5,0),'cockpitFront':(0,.70,.73)}
for key,p in anchors.items():
 ob=bpy.data.objects.new('ANCHOR_'+key,None); scene.collection.objects.link(ob); ob.location=p; ob.parent=boat; ob.empty_display_size=.12
# Broad studio sunlight; transparent world, no baked water/wake.
def area(name,location,energy,size,color):
 bpy.ops.object.light_add(type='AREA',location=location); ob=bpy.context.object; ob.name=name; ob.data.energy=energy; ob.data.shape='DISK'; ob.data.size=size; ob.data.color=color; ob.rotation_euler=(Vector((0,0,.3))-ob.location).to_track_quat('-Z','Y').to_euler()
area('Large warm key',(-4,-1,9),750,7,(1,.93,.80)); area('Cool fill',(5,2,5),350,6,(.70,.86,1)); area('Bow rim',(0,7,6),500,5,(1,1,.9))
bpy.ops.object.camera_add(); camera=bpy.context.object; camera.name='Orthographic chase camera'; camera.data.type='ORTHO'; camera.data.ortho_scale=8.1; camera.data.lens=50; scene.camera=camera

def set_camera(elev):
 target=Vector((0,.1,.40)); camera.location=target+Vector((0,-14*math.cos(math.radians(elev)),14*math.sin(math.radians(elev)))); camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
set_camera(18)
# Normalize outward normals on authored mesh shells before export.
import bmesh
for ob in scene.objects:
 if ob.type=='MESH' and ob.parent==boat:
  bm=bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(ob.data); bm.free()
# Export source with canonical upright pose and all anchors selected.
bpy.ops.object.select_all(action='DESELECT')
for ob in scene.objects:
 if ob.parent==boat or ob==boat: ob.select_set(True)
bpy.context.view_layer.objects.active=boat
bpy.ops.export_scene.gltf(filepath=OUT+'/sunfish-07-hydroplane.glb',export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/sunfish-07-hydroplane.blend')
angles=list(range(-40,41,10))
metadata={'name':'Sunfish 07 original arcade hydroplane','tileWidth':768,'tileHeight':512,'layout':{'columns':3,'rows':3},'headings':angles,'camera':{'projection':'orthographic','orthoScale':8.1,'target':[0,.1,.4]},'modelAxes':{'forward':'+Y','right':'+X','up':'+Z'},'anchorsBoatSpace':anchors,'variants':{}}
# Environment variable allows one quick first render before full atlas.
mode=os.environ.get('BOAT_RENDER_MODE','full')
color_sets={'player':[(paint,(1,.62,.003)),(edge,(.69,.35,.012)),(spine,(.018,.58,.004)),(spineEdge,(.075,.37,.012)),(accent,(.76,1,.04))], 'rival':[(paint,(.45,.12,.90)),(edge,(.21,.035,.43)),(spine,(.005,.69,.85)),(spineEdge,(.007,.25,.34)),(accent,(.4,.92,1))]}
for variant in ['player','rival']:
 for m,c in color_sets[variant]: m.diffuse_color=(*c,1); m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1)
 metadata['variants'][variant]={}
 for elev in [18,32]:
  set_camera(elev); frames=[]
  for idx,deg in enumerate(angles):
   if mode=='test' and (variant!='player' or elev!=32 or deg!=0): continue
   # Positive heading turns bow toward screen right.
   boat.rotation_euler.z=math.radians(-deg); bpy.context.view_layer.update()
   path=f'{OUT}/renders/{variant}-e{elev}-heading{deg:+03d}.png'
   scene.render.filepath=path; bpy.ops.render.render(write_still=True)
   pix={}
   for key,p in anchors.items():
    co=world_to_camera_view(scene,camera,boat.matrix_world@Vector(p)); pix[key]=[round(co.x*768,2),round((1-co.y)*512,2)]
   frames.append({'index':idx,'headingDegrees':deg,'image':os.path.basename(path),'rect':{'x':(idx%3)*768,'y':(idx//3)*512,'w':768,'h':512},'anchors':pix})
  metadata['variants'][variant][f'elevation{elev}']={'atlas':f'{variant}-e{elev}-heading-atlas.png','frames':frames}
boat.rotation_euler.z=0
for m,c in color_sets['player']: m.diffuse_color=(*c,1); m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1)
set_camera(32)
with open(OUT+'/boat-atlas.json','w') as f: json.dump(metadata,f,indent=2)
print('BOAT_ASSETS_RENDER_COMPLETE')
