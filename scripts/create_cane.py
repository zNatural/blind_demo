"""Create the first-person hand and mobility cane in a separate Blender scene."""
import bpy, os
from mathutils import Vector

ROOT = r'C:\Users\Ntrl\Documents\ChatGPT\blind_demo'
main_scene = bpy.context.window.scene
previous = bpy.data.scenes.get('Baston y mano')
scene = bpy.data.scenes.new('Baston y mano')
bpy.context.window.scene = scene
if previous:
    for obj in list(previous.objects):
        if len(obj.users_scene) == 1:
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.scenes.remove(previous)
scene.name = 'Baston y mano'

def mat(name, rgb):
    m = bpy.data.materials.new(name); m.use_nodes = True
    node = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value = (*rgb, 1)
    node.inputs['Roughness'].default_value = .65
    return m

ivory = mat('Baston blanco', (.94,.92,.84))
red = mat('Banda roja', (.7,.025,.035))
grip = mat('Empunadura', (.025,.035,.03))
skin = mat('Mano', (.66,.31,.19))
sleeve = mat('Manga verde', (.055,.10,.08))

def rod(name, a, b, radius, material):
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=radius, depth=(b-a).length, location=(a+b)/2)
    obj=bpy.context.object;obj.name=name
    obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();obj.data.materials.append(material)

# Coordinates map to player-local X, -Z, Y after glTF conversion.
# At eye height 1.65 m the tip reaches the floor, not the terminal screen.
a=Vector((.20,.45,-.36)); b=Vector((-.10,1.10,-1.64))
for i in range(7):
    rod('Tramo baston', a.lerp(b,i/7), a.lerp(b,(i+1)/7), .012, red if i==4 else ivory)
rod('Empunadura',a.lerp(b,-.07),a.lerp(b,.08),.021,grip)
bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=5, radius=.025, location=b)
bpy.context.object.name='Punta baston';bpy.context.object.data.materials.append(ivory)
rod('Antebrazo',(.37,.32,-.65),(.23,.43,-.41),.060,sleeve)
rod('Muneca',(.24,.42,-.44),(.21,.45,-.36),.047,skin)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=(.20,.45,-.355))
hand=bpy.context.object;hand.name='Mano en agarre';hand.scale=(.075,.080,.063);hand.data.materials.append(skin)
for i in range(4):
    rod('Dedo',(.16+i*.023,.50,-.34),(.16+i*.023,.50,-.40),.017,skin)
rod('Pulgar',(.13,.44,-.34),(.17,.50,-.32),.025,skin)
os.makedirs(os.path.join(ROOT,'public','models'),exist_ok=True)
bpy.data.libraries.write(os.path.join(ROOT,'public','models','baston-mano.blend'),{scene},fake_user=True,compress=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public','models','baston-mano.glb'),use_active_scene=True)
bpy.context.window.scene=main_scene
print('Cane and hand exported')
