from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import json, math, shutil
root=Path(__file__).resolve().parent
metadata=json.loads((root/'boat-atlas.json').read_text())
metadata['exportedGlbAxes']={'forward':'-Z','right':'+X','up':'+Y'}
metadata['positiveHeading']='Bow rotates toward screen right; angle 0 is directly rear-facing.'
metadata['alpha']='Straight RGBA PNG transparency; no ground, water, character, wake, or dither.'
metadata['anchorUnits']='Pixels from top-left of the full 768 x 512 frame, before any cropping.'
metadata['suggestedElevations']={'lowChase':18,'referenceLike':32}
metadata['cropping']='Each full tile is the same size. alphaBounds is per-frame tight visible content. uniformCrop is shared across all nine frames at the same elevation. Cropped-atlas anchors subtract uniformCrop.x/y.'
contact=Image.new('RGB',(1536,1130),'#102d3c'); draw=ImageDraw.Draw(contact)
try:
 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',26)
 small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',19)
except: font=small=ImageFont.load_default()
draw.text((42,27),'SUNFISH 07 / ORIGINAL ARCADE HYDROPLANE',fill='#ecfaed',font=font)
draw.text((42,65),'Rear heading range: -40° to +40°   •   Two liveries   •   True RGBA renders',fill='#94b8c4',font=small)
for variant,vdata in metadata['variants'].items():
 for elevation,data in vdata.items():
  frames=data['frames']; assert len(frames)==9,(variant,elevation,len(frames))
  atlas=Image.new('RGBA',(2304,1536),(0,0,0,0)); bounds=[]
  for fr in frames:
   path=root/'renders'/fr['image']; im=Image.open(path).convert('RGBA'); assert im.size==(768,512)
   bb=im.getchannel('A').getbbox(); assert bb and bb[0]>0 and bb[1]>0 and bb[2]<768 and bb[3]<512,(path,bb)
   fr['alphaBounds']={'x':bb[0],'y':bb[1],'w':bb[2]-bb[0],'h':bb[3]-bb[1]}; bounds.append(bb)
   atlas.paste(im,(fr['rect']['x'],fr['rect']['y']))
  atlas.save(root/data['atlas'],optimize=True)
  # Use all-angle crop, retaining eight pixels of safety on each side.
  bb=(max(0,min(b[0] for b in bounds)-8),max(0,min(b[1] for b in bounds)-8),min(768,max(b[2] for b in bounds)+8),min(512,max(b[3] for b in bounds)+8))
  cw,ch=bb[2]-bb[0],bb[3]-bb[1]
  data['uniformCrop']={'x':bb[0],'y':bb[1],'w':cw,'h':ch}
  cropped=Image.new('RGBA',(cw*3,ch*3),(0,0,0,0))
  for fr in frames:
   im=Image.open(root/'renders'/fr['image']).convert('RGBA').crop(bb)
   cropped.paste(im,((fr['index']%3)*cw,(fr['index']//3)*ch))
   fr['croppedAnchors']={k:[round(p[0]-bb[0],2),round(p[1]-bb[1],2)] for k,p in fr['anchors'].items()}
   fr['croppedRect']={'x':(fr['index']%3)*cw,'y':(fr['index']//3)*ch,'w':cw,'h':ch}
  data['croppedAtlas']=data['atlas'].replace('.png','-cropped.png')
  cropped.save(root/data['croppedAtlas'],optimize=True)
# Default aliases use requested low-chase elevation.
shutil.copyfile(root/'player-e18-heading-atlas.png',root/'player-heading-atlas.png')
shutil.copyfile(root/'rival-e18-heading-atlas.png',root/'rival-heading-atlas.png')
# Preview card uses the original frames without retouching; labels stay outside the art.
for row,elev in enumerate([32,18]):
 for col,deg in enumerate([-30,0,30]):
  x,y=col*512,116+row*488
  draw.rounded_rectangle((x+16,y,x+496,y+472),radius=18,fill='#194052')
  variant='player' if row==0 else 'rival'
  im=Image.open(root/'renders'/f'{variant}-e{elev}-heading{deg:+03d}.png').convert('RGBA')
  im.thumbnail((492,398),Image.Resampling.LANCZOS)
  contact.paste(im,(x+(512-im.width)//2,y+35),im)
  draw.text((x+36,y+418),f'{variant.upper()}   {deg:+d}° heading   {elev}° elevation',fill='#d9f3ef',font=small)
contact.save(root/'boat-preview.png')
(root/'boat-atlas.json').write_text(json.dumps(metadata,indent=2))
print('Atlases complete')
for v,data in metadata['variants'].items():
 for e,d in data.items(): print(v,e,d['uniformCrop'],d['frames'][4]['anchors'])
