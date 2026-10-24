"""Run in Blender through Blender MCP. All distances are metres."""
import bpy, math, os
from mathutils import Vector

ROOT = r'C:\Users\Ntrl\Documents\ChatGPT\blind_demo'
previous = bpy.data.scenes.get('Retiro accesible')
scene = bpy.data.scenes.new('Retiro accesible')
bpy.context.window.scene = scene
if previous:
    for obj in list(previous.objects):
        if len(obj.users_scene) == 1:
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.scenes.remove(previous)
scene.name = 'Retiro accesible'

def material(name, color, metal=0, rough=.5, emission=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    if emission:
        p.inputs['Emission Color'].default_value = (*color, 1)
        p.inputs['Emission Strength'].default_value = emission
    return m

steel = material('Grafito satinado', (.15,.18,.18), .65)
door = material('Puertas acero', (.27,.31,.30), .6)
dark = material('Negro carbon', (.022,.031,.03))
yellow = material('Amarillo accesible', (.98,.62,.025), .25)
white = material('Marfil', (.85,.88,.81))
green = material('Confirmar verde', (.2,.63,.31), .2)
screen = material('Pantalla verde', (.08,.29,.23), .2, emission=.35)
light = material('Luz calida', (1,.85,.56), emission=3)
wood = material('Madera', (.31,.15,.065))
cardboard = material('Carton', (.57,.34,.15))
tape = material('Cinta papel', (.8,.64,.4))
floor = material('Pavimento', (.085,.105,.10), .1, .8)

def cube(name, loc, size, mat, bevel=.015, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o=bpy.context.object; o.name=name; o.dimensions=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Bordes suaves','BEVEL');mod.width=bevel;mod.segments=2
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if parent: o.parent=parent
    return o

def text(name, value, loc, size, mat, parent=None):
    c=bpy.data.curves.new(name,'FONT');c.body=value;c.size=size;c.align_x='CENTER';c.align_y='CENTER';c.extrude=.003
    o=bpy.data.objects.new(name,c);scene.collection.objects.link(o)
    o.location=loc;o.rotation_euler=(math.pi/2,0,0);o.data.materials.append(mat)
    if parent:o.parent=parent
    return o

def empty(name, loc=(0,0,0)):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.location=loc;return o

# Central terminal faces the entrance (negative Blender Y).
t=empty('Totem')
cube('Base totem',(0,0,.065),(.85,.72,.13),steel,parent=t)
cube('Cuerpo totem',(0,0,1.03),(.64,.48,1.94),steel,parent=t)
cube('Panel frontal',(0,-.251,1.12),(.57,.025,1.68),door,parent=t)
cube('Marco pantalla',(0,-.276,1.64),(.5,.035,.44),dark,parent=t)
cube('Pantalla',(0,-.3,1.64),(.43,.012,.36),screen,parent=t)
text('Pantalla titulo','HOLA',(0,-.315,1.71),.075,white,t)
text('Pantalla texto','INGRESA TU CODIGO',(0,-.315,1.60),.027,white,t)
cube('Luz terminal',(0,-.26,2.025),(.52,.045,.025),light,parent=t)
for r in range(4):
    for c in range(9):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=6,ring_count=4,radius=.009,location=((c-4)*.027,-.279,1.31+r*.024))
        o=bpy.context.object;o.name='Perforacion altavoz';o.scale.y=.3;o.data.materials.append(dark);o.parent=t
keys=['1','2','3','4','5','6','7','8','9','BACK','0','OK']
for i,k in enumerate(keys):
    x=(i%3-1)*.13;z=1.16-(i//3)*.12
    cube('Key_'+k,(x,-.292,z),(.105,.055,.091),green if k=='OK' else dark,.008,t)
    text('Label_'+k,'<' if k=='BACK' else k,(x,-.326,z),.041,white,t)
    if k=='5':cube('Referencia tactil 5',(x,-.332,z-.032),(.022,.009,.005),white,.002,t)
text('Totem marca','NODO / 01',(0,-.278,.42),.037,white,t)

# Three banks arranged around the terminal. Door 17 has an independent hinge.
for bank_index,(bx,by,angle,start) in enumerate([(0,3.9,0,1),(-4,1.8,math.pi/2,13),(4,1.8,-math.pi/2,25)]):
    bank=empty('Bank_'+str(bank_index));
    cube('Fondo interior',(0,.66,1.4),(3.08,.065,2.8),dark,parent=bank)
    for x in [-1.51,1.51]:
        cube('Lateral carcasa',(x,.30,1.4),(.065,.74,2.8),steel,parent=bank)
    for z in [.07,.24,1.04,1.84,2.64,2.77]:
        cube('Estante',(0,.30,z),(3.08,.74,.045),steel,parent=bank)
    for x in [-.72,0,.72]:
        cube('Division vertical',(x,.30,1.44),(.035,.74,2.4),steel,parent=bank)
    cube('Luz casilleros',(0,-.09,2.75),(2.85,.08,.035),light,parent=bank)
    for row in range(3):
        for col in range(4):
            num=start+row*4+col;x=(col-1.5)*.72;z=2.24-row*.80
            hinge=empty('DoorPivot_'+str(num),(x-.34,-.13,z));hinge.parent=bank
            cube('Door_'+str(num),(.34,0,0),(.684,.065,.755),yellow if num==17 else door,parent=hinge)
            text('RaisedNumber_'+str(num),str(num).zfill(2),(.34,-.042,.06),.14,dark if num==17 else white,hinge)
            cube('Manilla_'+str(num),(.60,-.065,-.12),(.028,.06,.18),dark,.006,hinge)
            # Tactile markers below the raised number.
            for dot in range(3):
                bpy.ops.mesh.primitive_uv_sphere_add(segments=6,ring_count=4,radius=.013,location=(.29+dot*.045,-.049,-.105))
                o=bpy.context.object;o.name='Puntos tactiles';o.data.materials.append(white);o.parent=hinge
            if num==17:
                p=empty('Package', (x,.22,z-.18));p.parent=bank
                cube('Caja paquete',(0,0,0),(.43,.39,.32),cardboard,parent=p)
                cube('Cinta paquete',(0,-.005,.166),(.07,.39,.008),tape,.002,p)
    bank.location=(bx,by,0);bank.rotation_euler.z=angle

def tile(x,y,warning=False,rotate=False):
    cube('Baldosa advertencia' if warning else 'Baldosa guia',(x,y,.025),(.49,.49,.045),yellow,.007)
    if warning:
        for a in range(4):
            for b in range(4):
                bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=.026,location=(x+(a-1.5)*.105,y+(b-1.5)*.105,.055))
                o=bpy.context.object;o.name='Boton podotactil';o.scale.z=.5;o.data.materials.append(yellow)
    else:
        for a in range(4):
            size=(.39,.032,.022) if rotate else (.032,.39,.022)
            loc=(x,y+(a-1.5)*.105,.058) if rotate else (x+(a-1.5)*.105,y,.058)
            cube('Relieve direccional',loc,size,yellow,.006)
for i in range(10):tile(0,-5.5+i*.5)
for x in [-.5,0,.5]:
    for y in [-1,-.5]:tile(x,y,True)
for i in range(1,8):tile(-i*.5,-.5,rotate=True);tile(i*.5,-.5,rotate=True)
for i in range(5):tile(-3.5,i*.5);tile(3.5,i*.5)
for i in range(1,8):tile(1,i*.5)
for x,y in [(-3.5,1.5),(3.5,1.5),(1,3)]:tile(x,y,True)

cube('Suelo',(0,0,-.1),(12,14,.18),floor)
cube('Pared fondo',(0,4.6,1.9),(12,.15,3.8),steel)
for x in [-5.5,5.5]:
    for y in [-3.5,3.7]:
        cube('Pilar',(x,y,1.8),(.5,.5,3.6),steel)
        cube('Zocalo pilar',(x,y,.25),(.62,.62,.5),door)
for x in [-4.5,4.5]:
    for s in range(4):cube('Liston banca',(x,-3+s*.12,.5),(1.8,.10,.07),wood)
    for dx in [-.7,.7]:cube('Pata banca',(x+dx,-2.82,.25),(.07,.5,.5),steel)
text('Senaletica','RETIRO DE PEDIDOS',(0,4.50,3.32),.24,white)
text('Senaletica secundaria','01 - 12',(0,4.49,3.0),.10,yellow)

bpy.ops.object.camera_add(location=(9,-12,9))
cam=bpy.context.object;cam.name='Camera Demo';cam.rotation_euler=(Vector((0,0,0.8))-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
for loc,power,size in [((0,-1,6),1800,8),((-4,1,4),800,4),((4,1,4),800,4)]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size
scene.world=bpy.data.worlds.new('World Demo');scene.world.use_nodes=True
next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.12,.16,.15,1)
os.makedirs(os.path.join(ROOT,'public','models'),exist_ok=True)
bpy.data.libraries.write(os.path.join(ROOT,'public','models','centro-accesible.blend'), {scene}, fake_user=True, compress=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public','models','centro-accesible.glb'),use_active_scene=True,export_extras=True)
print('EXPORTED',len(scene.objects),'objects')
