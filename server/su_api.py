import os,ctypes as C,math,json
from pathlib import Path
SDK=Path('C:/Program Files/SketchUp/SketchUp 2023')
DLLDIR=os.add_dll_directory(str(SDK));A=C.CDLL(str(SDK/'SketchUpAPI.dll'))
class Ref(C.Structure):_fields_=[('ptr',C.c_void_p)]
class V3(C.Structure):_fields_=[('x',C.c_double),('y',C.c_double),('z',C.c_double)]
class V2(C.Structure):_fields_=[('x',C.c_double),('y',C.c_double)]
class Color(C.Structure):_fields_=[('red',C.c_ubyte),('green',C.c_ubyte),('blue',C.c_ubyte),('alpha',C.c_ubyte)]
class BBox(C.Structure):_fields_=[('min',V3),('max',V3)]
class Transform(C.Structure):_fields_=[('values',C.c_double*16)]
class MatInput(C.Structure):_fields_=[('num_uv_coords',C.c_size_t),('uv_coords',V2*4),('vertex_indices',C.c_size_t*4),('material',Ref)]
P=C.POINTER;S=C.c_size_t;I=C.c_int;B=C.c_bool;F=C.c_double;U=C.c_char_p
def bind(n,args,ret=I):
    f=getattr(A,n);f.argtypes=args;f.restype=ret;return f
protos={
'SUModelCreate':[P(Ref)],'SUModelRelease':[P(Ref)],'SUModelSaveToFile':[Ref,U],'SUModelCreateFromFileWithStatus':[P(Ref),U,P(I)],'SUModelGetEntities':[Ref,P(Ref)],
'SUModelAddMaterials':[Ref,S,P(Ref)],'SUMaterialCreate':[P(Ref)],'SUMaterialSetName':[Ref,U],'SUMaterialSetColor':[Ref,P(Color)],'SUMaterialSetOpacity':[Ref,F],'SUMaterialSetUseOpacity':[Ref,B],
'SULayerCreate':[P(Ref)],'SULayerSetName':[Ref,U],'SUModelAddLayers':[Ref,S,P(Ref)],'SUDrawingElementSetLayer':[Ref,Ref],'SUDrawingElementSetHidden':[Ref,B],
'SUGroupCreate':[P(Ref)],'SUGroupSetName':[Ref,U],'SUGroupGetEntities':[Ref,P(Ref)],'SUEntitiesAddGroup':[Ref,Ref],
'SUGeometryInputCreate':[P(Ref)],'SUGeometryInputRelease':[P(Ref)],'SUGeometryInputSetVertices':[Ref,S,P(V3)],'SULoopInputCreate':[P(Ref)],'SULoopInputAddVertexIndex':[Ref,S],
'SUGeometryInputAddFace':[Ref,P(Ref),P(S)],'SUGeometryInputFaceAddInnerLoop':[Ref,S,P(Ref)],'SUGeometryInputFaceSetFrontMaterial':[Ref,S,P(MatInput)],'SUGeometryInputFaceSetBackMaterial':[Ref,S,P(MatInput)],'SUEntitiesFill':[Ref,Ref,B],
'SUEntitiesGetBoundingBox':[Ref,P(BBox)],'SUEntitiesGetNumFaces':[Ref,P(S)],'SUEntitiesGetNumEdges':[Ref,B,P(S)],'SUEntitiesGetNumGroups':[Ref,P(S)],'SUEntitiesGetGroups':[Ref,S,P(Ref),P(S)],
'SUGroupGetName':[Ref,P(Ref)],'SUStringCreate':[P(Ref)],'SUStringGetUTF8Length':[Ref,P(S)],'SUStringGetUTF8':[Ref,S,U,P(S)],'SUStringRelease':[P(Ref)],
'SUModelGetNumScenes':[Ref,P(S)],'SUModelGetNumMaterials':[Ref,P(S)],'SUSceneCreate':[P(Ref)],'SUSceneSetName':[Ref,U],'SUSceneSetUseCamera':[Ref,B],'SUSceneSetUseHiddenObjects':[Ref,B],'SUSceneSetDrawingElementHidden':[Ref,Ref,B],'SUSceneSetCamera':[Ref,Ref],'SUModelAddScenes':[Ref,S,P(Ref)],'SUModelSetActiveScene':[Ref,Ref],
'SUCameraCreate':[P(Ref)],'SUCameraSetOrientation':[Ref,P(V3),P(V3),P(V3)],'SUCameraSetPerspective':[Ref,B],'SUCameraSetOrthographicFrustumHeight':[Ref,F],'SUCameraSetPerspectiveFrustumFOV':[Ref,F],'SUModelSetCamera':[Ref,P(Ref)],
'SUModelLoadDefinitionWithStatus':[Ref,U,P(Ref),P(I)],'SUComponentDefinitionGetEntities':[Ref,P(Ref)],'SUComponentDefinitionCreateInstance':[Ref,P(Ref)],'SUComponentInstanceSetTransform':[Ref,P(Transform)],'SUComponentInstanceSetName':[Ref,U],'SUEntitiesAddInstance':[Ref,Ref,U],
'SUModelGetOptionsManager':[Ref,P(Ref)],'SUOptionsManagerGetOptionsProviderByName':[Ref,U,P(Ref)],'SUTypedValueCreate':[P(Ref)],'SUTypedValueSetInt32':[Ref,C.c_int32],'SUTypedValueSetBool':[Ref,B],'SUTypedValueRelease':[P(Ref)],'SUOptionsProviderSetValue':[Ref,U,Ref],
'SUModelGetRenderingOptions':[Ref,P(Ref)],'SURenderingOptionsSetValue':[Ref,U,Ref],
}
for n,args in protos.items():bind(n,args)
for n in ['SUGroupToDrawingElement','SUComponentInstanceToDrawingElement']:bind(n,[Ref],Ref)
bind('SUInitialize',[],None);bind('SUTerminate',[],None)
A.SUInitialize()
def check(n,*args):
    r=getattr(A,n)(*args)
    if r!=0:raise RuntimeError(f'{n}: SUResult {r}')
    return r
def new(n,*args):
    ref=Ref();check(n,*args,C.byref(ref));return ref
def enc(s):return str(s).encode('utf-8')
def point(p):return V3(*(float(x)/25.4 for x in p))
def bbox(ents):
    b=BBox();check('SUEntitiesGetBoundingBox',ents,C.byref(b));return [[b.min.x*25.4,b.min.y*25.4,b.min.z*25.4],[b.max.x*25.4,b.max.y*25.4,b.max.z*25.4]]
def read_string(getter,ref):
    s=new('SUStringCreate');check(getter,ref,C.byref(s));n=S();check('SUStringGetUTF8Length',s,C.byref(n));buf=C.create_string_buffer(n.value+1);out=S();check('SUStringGetUTF8',s,n.value+1,buf,C.byref(out));check('SUStringRelease',C.byref(s));return buf.value.decode('utf-8')
def get_count(func,ref,*args):
    n=S();check(func,ref,*args,C.byref(n));return n.value
class Mesh:
    def __init__(self):self.v=[];self.faces=[];self.lookup={}
    def face(self,pts,holes=None):
        def indices(points):
            out=[];seen=set()
            for p in points:
                key=tuple(round(float(x),4) for x in p)
                if key not in self.lookup:self.lookup[key]=len(self.v);self.v.append(key)
                i=self.lookup[key]
                if i not in seen:out.append(i);seen.add(i)
            if len(out)>1 and out[0]==out[-1]:out.pop()
            return out
        ids=indices(pts)
        if len(set(ids))<3:return
        self.faces.append((ids,[indices(h) for h in holes or []]))
    def prism(self,outer,z0,z1,holes=None):
        holes=holes or []
        def orient(poly,ccw):
            area=sum(p[0]*q[1]-q[0]*p[1] for p,q in zip(poly,poly[1:]+poly[:1]))
            return poly if (area>0)==ccw else list(reversed(poly))
        outer=orient(list(outer),True);holes=[orient(list(h),False) for h in holes]
        self.face([(x,y,z0) for x,y in reversed(outer)],[[(x,y,z0) for x,y in reversed(h)] for h in holes])
        self.face([(x,y,z1) for x,y in outer],[[(x,y,z1) for x,y in h] for h in holes])
        for poly in [outer]+holes:
            for a,b in zip(poly,poly[1:]+poly[:1]):self.face([(a[0],a[1],z0),(b[0],b[1],z0),(b[0],b[1],z1),(a[0],a[1],z1)])
    def box(self,b):
        x,y,a,c,z0,z1=b
        if a-x<.01 or c-y<.01 or z1-z0<.01:return
        self.prism([(x,y),(a,y),(a,c),(x,c)],z0,z1)
    def cylinder(self,x,y,r,z0,z1,n=16):self.prism([(x+r*math.cos(i*2*math.pi/n),y+r*math.sin(i*2*math.pi/n)) for i in range(n)],z0,z1)
    def fill(self,ents,material):
        if not self.faces:return
        geom=new('SUGeometryInputCreate');arr=(V3*len(self.v))(*(point(p) for p in self.v));check('SUGeometryInputSetVertices',geom,len(self.v),arr)
        mi=MatInput();mi.material=material
        def loop(ids):
            ref=new('SULoopInputCreate')
            for i in ids:check('SULoopInputAddVertexIndex',ref,i)
            return ref
        for ids,holes in self.faces:
            lp=loop(ids);idx=S();check('SUGeometryInputAddFace',geom,C.byref(lp),C.byref(idx))
            for h in holes:
                if len(set(h))>=3:lp=loop(h);check('SUGeometryInputFaceAddInnerLoop',geom,idx.value,C.byref(lp))
            check('SUGeometryInputFaceSetFrontMaterial',geom,idx.value,C.byref(mi));check('SUGeometryInputFaceSetBackMaterial',geom,idx.value,C.byref(mi))
        check('SUEntitiesFill',ents,geom,True);check('SUGeometryInputRelease',C.byref(geom))
class Model:
    def __init__(self,name):
        self.ref=new('SUModelCreate');self.ents=new('SUModelGetEntities',self.ref);self.name=name;self.materials={};self.tags={};self.roots={};self.meshes={};self.assets={};self.asset_usage=[];self.scenes=[]
        manager=new('SUModelGetOptionsManager',self.ref);provider=Ref()
        if A.SUOptionsManagerGetOptionsProviderByName(manager,b'UnitsOptions',C.byref(provider))==0:
            for k,v in [('LengthUnit',2),('LengthFormat',0),('LengthPrecision',0)]:
                tv=new('SUTypedValueCreate');check('SUTypedValueSetInt32',tv,v);check('SUOptionsProviderSetValue',provider,enc(k),tv);check('SUTypedValueRelease',C.byref(tv))
        render=new('SUModelGetRenderingOptions',self.ref)
        for k,v in [('DisplayColorByLayer',False),('DrawGround',False),('DrawSky',False),('DisplaySectionPlanes',False),('DisplaySectionCuts',False)]:
            tv=new('SUTypedValueCreate');check('SUTypedValueSetBool',tv,v);A.SURenderingOptionsSetValue(render,enc(k),tv);check('SUTypedValueRelease',C.byref(tv))
    def material(self,name,color,opacity=1):
        if name not in self.materials:
            ref=new('SUMaterialCreate');check('SUMaterialSetName',ref,enc(name));col=Color(*color,255);check('SUMaterialSetColor',ref,C.byref(col))
            if opacity<1:check('SUMaterialSetUseOpacity',ref,True);check('SUMaterialSetOpacity',ref,opacity)
            check('SUModelAddMaterials',self.ref,1,(Ref*1)(ref));self.materials[name]=ref
        return self.materials[name]
    def group(self,name,parent=None,tag=True):
        group=new('SUGroupCreate');check('SUGroupSetName',group,enc(name));check('SUEntitiesAddGroup',parent or self.ents,group);ents=new('SUGroupGetEntities',group)
        if tag:
            layer=new('SULayerCreate');check('SULayerSetName',layer,enc(name));check('SUModelAddLayers',self.ref,1,(Ref*1)(layer));check('SUDrawingElementSetLayer',A.SUGroupToDrawingElement(group),layer);self.tags[name]=layer
        return group,ents
    def root(self,name):
        if name not in self.roots:self.roots[name]=self.group(name)
        return self.roots[name][1]
    def mesh(self,root,kind,material):
        key=(root,kind,material)
        if key not in self.meshes:self.meshes[key]=Mesh()
        return self.meshes[key]
    def build(self):
        for (root,kind,mat),mesh in self.meshes.items():
            _,ents=self.group(kind+' | '+mat,self.root(root),False);mesh.fill(ents,self.materials[mat])
    def camera(self,eye,target,up=(0,0,1),height=26000,fov=None):
        # fov(도)를 주면 원근 카메라(새 카메라의 기본값이 원근이라 화각만 정한다), 없으면 평행 투영(height = 화면에 담을 높이 mm)
        ref=new('SUCameraCreate');pe,pt,pu=point(eye),point(target),V3(*up);check('SUCameraSetOrientation',ref,C.byref(pe),C.byref(pt),C.byref(pu))
        if fov:check('SUCameraSetPerspectiveFrustumFOV',ref,fov)
        else:check('SUCameraSetPerspective',ref,False);check('SUCameraSetOrthographicFrustumHeight',ref,height/25.4)
        return ref
    def scene(self,name,visible,eye,target,height=26000,up=(0,0,1),fov=None):
        scene=new('SUSceneCreate');check('SUSceneSetName',scene,enc(name));check('SUSceneSetUseCamera',scene,True);check('SUSceneSetUseHiddenObjects',scene,True)
        cam=self.camera(eye,target,up,height,fov);check('SUSceneSetCamera',scene,cam);check('SUModelAddScenes',self.ref,1,(Ref*1)(scene))
        for root,(group,ents) in self.roots.items():check('SUSceneSetDrawingElementHidden',scene,A.SUGroupToDrawingElement(group),root not in visible)
        self.scenes.append(scene)
        if len(self.scenes)==1:
            cam2=self.camera(eye,target,up,height,fov);check('SUModelSetCamera',self.ref,C.byref(cam2));check('SUModelSetActiveScene',self.ref,scene)
    def load_asset(self,path):
        path=str(Path(path).resolve())
        if path not in self.assets:
            definition=Ref();status=I();check('SUModelLoadDefinitionWithStatus',self.ref,enc(path),C.byref(definition),C.byref(status));ents=new('SUComponentDefinitionGetEntities',definition);self.assets[path]=(definition,bbox(ents),status.value)
        return self.assets[path]
    def asset(self,path,root,name,b,rotate=False):
        definition,bb,status=self.load_asset(path);x,y,a,c,z0,z1=b
        mn,mx=bb;dims=[mx[i]-mn[i] for i in range(3)]
        if min(dims)<.1:raise ValueError(f'Invalid asset bounds {path}: {bb}')
        inst=new('SUComponentDefinitionCreateInstance',definition);check('SUComponentInstanceSetName',inst,enc(name))
        vals=[0.0]*16;vals[15]=1
        if not rotate:
            scales=[(a-x)/dims[0],(c-y)/dims[1],(z1-z0)/dims[2]]
            vals[0],vals[5],vals[10]=scales;vals[12],vals[13],vals[14]=[(u-mn[i]*scales[i])/25.4 for i,u in enumerate([x,y,z0])]
        else:
            scales=[(c-y)/dims[0],(a-x)/dims[1],(z1-z0)/dims[2]]
            vals[1]=scales[0];vals[4]=-scales[1];vals[10]=scales[2];vals[12]=(a+mn[1]*scales[1])/25.4;vals[13]=(y-mn[0]*scales[0])/25.4;vals[14]=(z0-mn[2]*scales[2])/25.4
        check('SUComponentInstanceSetTransform',inst,C.byref(Transform((C.c_double*16)(*vals))));check('SUEntitiesAddInstance',self.root(root),inst,None)
        self.asset_usage.append({'source':str(path),'name':name,'group':root,'target_box_mm':b,'source_bounds_mm':bb,'version_load_status':status})
    def save(self,path):
        check('SUModelSaveToFile',self.ref,enc(Path(path).resolve()));report={'file':str(path),'roots':list(self.roots),'scenes':len(self.scenes),'materials':len(self.materials),'bounds_mm':bbox(self.ents),'generated_groups':len(self.meshes),'assets':self.asset_usage}
        check('SUModelRelease',C.byref(self.ref));return report

if __name__=='__main__':
    m=Model('API smoke test');m.material('Stone',(190,180,160));m.mesh('Building','Test cube','Stone').box([0,0,1000,1000,0,1000]);m.build();m.scene('Exterior',set(m.roots),(3000,-3000,2500),(500,500,500),height=3000);print(m.save(Path(__file__).parent/'api_test.skp'))
