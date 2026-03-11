"""Generates standalone embeddable widget HTML for a Spectrum emotion."""

VERTEX_SHADER = r"""
uniform float uTime;
uniform float uNoiseAmp;
varying vec3 vPosition;
varying vec3 vNormal;
vec3 mod289v3(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289v4(((x*34.)+10.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289v3(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 v){float val=0.,amp=.5,freq=1.;for(int i=0;i<4;i++){val+=amp*snoise(v*freq);amp*=.5;freq*=2.1;}return val;}
void main(){
  vNormal=normal;vec3 pos=position;
  float noise=fbm(pos*1.2+uTime*0.2);pos+=normal*noise*uNoiseAmp;
  vPosition=pos;gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.);
}
"""

FRAGMENT_SHADER = r"""
uniform float uHue;
uniform float uTransparency;
uniform float uTime;
varying vec3 vPosition;
varying vec3 vNormal;
vec3 hsl2rgb(float h,float s,float l){
  float c=(1.-abs(2.*l-1.))*s;float hp=h/60.;float x=c*(1.-abs(mod(hp,2.)-1.));
  vec3 rgb;
  if(hp<1.)rgb=vec3(c,x,0.);else if(hp<2.)rgb=vec3(x,c,0.);else if(hp<3.)rgb=vec3(0.,c,x);
  else if(hp<4.)rgb=vec3(0.,x,c);else if(hp<5.)rgb=vec3(x,0.,c);else rgb=vec3(c,0.,x);
  return rgb+(l-c*.5);
}
void main(){
  float hueShift=sin(vPosition.x*2.+uTime*.5)*15.;float hue=mod(uHue+hueShift,360.);
  vec3 viewDir=normalize(cameraPosition-vPosition);
  float fresnel=pow(1.-abs(dot(viewDir,vNormal)),2.);
  float iriAngle=fresnel*2.5+uTime*0.3;float iriHue=mod(hue+sin(iriAngle)*45.,360.);
  vec3 iriColor=hsl2rgb(iriHue,1.,0.62);float rim=pow(fresnel,1.5);
  vec3 rimColor=hsl2rgb(mod(hue+60.,360.),1.,0.82);
  vec3 baseColor=hsl2rgb(hue,.9,.58);vec3 color=mix(baseColor,iriColor,.35);
  color=mix(color,rimColor,rim*.65);color+=rimColor*pow(fresnel,3.5)*.6;
  float alpha=(1.-uTransparency)*(.6+fresnel*.4);
  gl_FragColor=vec4(color,alpha);
}
"""

GLOW_VERT = r"""
varying vec3 vNormal;varying vec3 vViewDir;
void main(){
  vNormal=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);
  vViewDir=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;
}
"""

GLOW_FRAG = r"""
uniform float uHue;varying vec3 vNormal;varying vec3 vViewDir;
vec3 hsl2rgb(float h,float s,float l){
  float c=(1.-abs(2.*l-1.))*s;float hp=h/60.;float x=c*(1.-abs(mod(hp,2.)-1.));
  vec3 rgb;
  if(hp<1.)rgb=vec3(c,x,0.);else if(hp<2.)rgb=vec3(x,c,0.);else if(hp<3.)rgb=vec3(0.,c,x);
  else if(hp<4.)rgb=vec3(0.,x,c);else if(hp<5.)rgb=vec3(x,0.,c);else rgb=vec3(c,0.,x);
  return rgb+(l-c*.5);
}
void main(){
  float fresnel=pow(1.-abs(dot(vNormal,vViewDir)),1.8);
  gl_FragColor=vec4(hsl2rgb(uHue,1.,.65),fresnel*0.28);
}
"""

BG_VERT = r"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"

BG_FRAG = r"""
uniform float uHue;uniform float uTime;varying vec2 vUv;
vec3 hsl2rgb(float h,float s,float l){
  float c=(1.-abs(2.*l-1.))*s;float hp=h/60.;float x=c*(1.-abs(mod(hp,2.)-1.));
  vec3 rgb;
  if(hp<1.)rgb=vec3(c,x,0.);else if(hp<2.)rgb=vec3(x,c,0.);else if(hp<3.)rgb=vec3(0.,c,x);
  else if(hp<4.)rgb=vec3(0.,x,c);else if(hp<5.)rgb=vec3(x,0.,c);else rgb=vec3(c,0.,x);
  return rgb+(l-c*.5);
}
float rand(vec2 co){return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec2 uv=vUv;float d=length(uv-.5);
  float nebula=exp(-d*3.5)*.18;vec3 nebulaColor=hsl2rgb(uHue,.7,.35);
  float star=0.;for(int i=0;i<3;i++){
    vec2 g=uv*(60.+float(i)*40.);vec2 cell=floor(g);float r=rand(cell+float(i)*77.7);
    if(r>.97){float tw=.6+.4*sin(uTime*(1.5+r*3.)+r*6.28);vec2 c=fract(g)-.5;
    star+=tw*smoothstep(.12,0.,length(c))*(r-.97)*30.;}
  }
  float dh=smoothstep(.55,.12,d);
  vec3 bg=vec3(.015,.028,.04)*(1.-dh*.82);
  bg+=nebulaColor*nebula*(1.-dh*.5);bg+=vec3(.9,.95,1.)*star*.7*(1.-dh);
  gl_FragColor=vec4(bg,1.);
}
"""


ZODIAC_JS = r"""
function _rect(x,y,w,h){const s=new THREE.Shape();s.moveTo(x,y);s.lineTo(x+w,y);s.lineTo(x+w,y+h);s.lineTo(x,y+h);s.closePath();return s;}
function _ring(cx,cy,R,r){const s=new THREE.Shape();s.absarc(cx,cy,R,0,Math.PI*2,false);const h=new THREE.Path();h.absarc(cx,cy,r,0,Math.PI*2,true);s.holes.push(h);return s;}
function _arc(cx,cy,R,r,a0,a1){const s=new THREE.Shape();s.moveTo(cx+Math.cos(a0)*R,cy+Math.sin(a0)*R);s.absarc(cx,cy,R,a0,a1,false);s.absarc(cx,cy,r,a1,a0,true);s.closePath();return s;}
function _star(n,R,r,rot){rot=rot||0;const s=new THREE.Shape();for(let i=0;i<n*2;i++){const a=(i/(n*2))*Math.PI*2+rot;const rd=i%2===0?R:r;if(i===0)s.moveTo(Math.cos(a)*rd,Math.sin(a)*rd);else s.lineTo(Math.cos(a)*rd,Math.sin(a)*rd);}s.closePath();return s;}
const ZB={
  aries:()=>[_arc(-0.48,0,0.65,0.40,0,Math.PI),_arc(0.48,0,0.65,0.40,0,Math.PI),_rect(-0.11,-0.48,0.22,0.55)],
  taurus:()=>[_ring(0,-0.18,0.70,0.45),_arc(-0.42,0.52,0.46,0.28,-Math.PI*0.05,Math.PI*1.05),_arc(0.42,0.52,0.46,0.28,-Math.PI*0.05,Math.PI*1.05)],
  gemini:()=>{const ph=1.4,pw=0.22,bw=1.52,bh=0.20,gap=0.38;return[_rect(-gap/2-pw,-ph/2,pw,ph),_rect(gap/2,-ph/2,pw,ph),_rect(-bw/2,ph/2,bw,bh),_rect(-bw/2,-ph/2-bh,bw,bh)];},
  cancer:()=>[_arc(0.12,0.42,0.60,0.38,-Math.PI*0.25,Math.PI*1.25),_arc(-0.12,-0.42,0.60,0.38,Math.PI*0.75,Math.PI*2.25)],
  leo:()=>{const t=new THREE.Shape();t.moveTo(0.70,0.20);t.bezierCurveTo(1.10,0.20,1.30,-0.10,1.10,-0.52);t.bezierCurveTo(0.90,-0.92,0.35,-0.98,0.18,-0.70);t.bezierCurveTo(0.46,-0.66,0.62,-0.40,0.52,-0.10);t.bezierCurveTo(0.50,0.00,0.46,0.06,0.46,0.06);t.lineTo(0.46,0.20);t.closePath();return[_ring(0,0.20,0.70,0.46),t];},
  virgo:()=>_star(6,1.0,0.42,Math.PI/2),
  libra:()=>[_arc(0,-0.12,0.62,0.42,0,Math.PI),_rect(-0.82,-0.46,1.64,0.18),_rect(-0.82,-0.80,1.64,0.18)],
  scorpio:()=>{const lX=0.53,lW=0.18,aR=0.40,aT=0.18;const a=new THREE.Shape();a.moveTo(lX-lW/2,0.08);a.lineTo(lX+lW/2,0.08);a.lineTo(lX+lW/2,-0.40);a.lineTo(lX+0.24,-0.40);a.lineTo(lX,-0.72);a.lineTo(lX-0.24,-0.40);a.lineTo(lX-lW/2,-0.40);a.closePath();return[_arc(-0.42,0.08,aR,aR-aT,0,Math.PI),_arc(0.18,0.08,aR,aR-aT,0,Math.PI),_rect(-0.42-lW/2,0.08-0.70,lW,0.70),_rect(0.18-lW/2,0.08-0.42,lW,0.42),a];},
  sagittarius:()=>{const s=new THREE.Shape();s.moveTo(0,1.0);s.lineTo(-0.38,0.32);s.lineTo(-0.14,0.32);s.lineTo(-0.14,-1.0);s.lineTo(0.14,-1.0);s.lineTo(0.14,0.32);s.lineTo(0.38,0.32);s.closePath();return s;},
  capricorn:()=>{const h=_arc(-0.52,0.28,0.62,0.40,Math.PI*0.52,Math.PI*1.40);const b=new THREE.Shape();b.moveTo(-0.14,0.10);b.lineTo(0.10,0.10);b.lineTo(0.55,-0.52);b.bezierCurveTo(0.78,-0.82,1.05,-0.78,1.02,-0.52);b.bezierCurveTo(0.98,-0.26,0.70,-0.28,0.58,-0.48);b.lineTo(0.30,-0.20);b.lineTo(-0.10,0.10);b.closePath();return[h,b];},
  aquarius:()=>{const h=0.16,A=0.28;return[0.28,-0.28].map(yB=>{const s=new THREE.Shape();s.moveTo(-1.0,yB);s.bezierCurveTo(-0.75,yB+A,-0.25,yB+A,0,yB);s.bezierCurveTo(0.25,yB-A,0.75,yB-A,1.0,yB);s.lineTo(1.0,yB+h);s.bezierCurveTo(0.75,yB+h-A,0.25,yB+h-A,0,yB+h);s.bezierCurveTo(-0.25,yB+h+A,-0.75,yB+h+A,-1.0,yB+h);s.closePath();return s;});},
  pisces:()=>[_arc(0.10,0.48,0.60,0.38,Math.PI*0.15,Math.PI*0.85),_arc(-0.10,-0.48,0.60,0.38,Math.PI*1.15,Math.PI*1.85),_rect(-0.10,-0.10,0.20,0.20)],
};
function buildGeometry(shape){
  const b=shape&&shape!=='cube'?ZB[shape]:null;
  if(!b)return new THREE.BoxGeometry(1.6,1.6,1.6,32,32,32);
  const arr=[b()].flat();
  const geo=new THREE.ExtrudeGeometry(arr,{depth:1.0,bevelEnabled:true,bevelThickness:0.12,bevelSize:0.08,bevelSegments:4});
  geo.center();geo.computeBoundingBox();
  const sz=new THREE.Vector3();geo.boundingBox.getSize(sz);
  const mxy=Math.max(sz.x,sz.y);if(mxy>0)geo.scale(1.6/mxy,1.6/mxy,1.6/mxy);
  return geo;
}
"""

SHAPE_NAMES_EN = {
    "cube": "Cube", "aries": "Aries", "taurus": "Taurus", "gemini": "Gemini",
    "cancer": "Cancer", "leo": "Leo", "virgo": "Virgo", "libra": "Libra",
    "scorpio": "Scorpio", "sagittarius": "Sagittarius", "capricorn": "Capricorn",
    "aquarius": "Aquarius", "pisces": "Pisces",
}


def build_widget_html(
    hue: float,
    transparency: float,
    rotation_speed: float,
    noise_amplitude: float,
    particle_density: float,
    shape: str = "cube",
    emotion_type: str = "",
    emotion_id: int | None = None,
    link_back: str = "",
) -> str:
    emotion_label = emotion_type or ""
    back_link = f'<a href="{link_back}" class="widget-link" target="_blank">↗</a>' if link_back else ""

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Spectrum{(" — " + emotion_label) if emotion_label else ""}</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{background:#050a0f;overflow:hidden;height:100vh;font-family:'Courier New',monospace}}
canvas{{display:block}}
.widget-label{{
  position:fixed;bottom:10px;left:12px;
  font-size:12px;color:rgba(0,255,170,.7);letter-spacing:.1em;
  pointer-events:none;text-transform:uppercase;
}}
.widget-link{{
  position:fixed;top:8px;right:10px;
  font-size:13px;color:rgba(0,255,170,.5);text-decoration:none;
  transition:color .15s;
}}
.widget-link:hover{{color:#00ffaa}}
</style>
</head>
<body>
{back_link}
<div class="widget-label">{emotion_label}</div>
<script type="importmap">{{"imports":{{"three":"https://unpkg.com/three@0.160.0/build/three.module.js"}}}}</script>
<script type="module">
import * as THREE from 'three';
const P={{hue:{hue},transparency:{transparency},rotationSpeed:{rotation_speed},noiseAmplitude:{noise_amplitude},particleDensity:{particle_density},shape:'{shape}'}};
{ZODIAC_JS}
const renderer=new THREE.WebGLRenderer({{antialias:true}});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.NoToneMapping;
document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.1,200);
camera.position.set(0,0,4.5);
const bgMat=new THREE.ShaderMaterial({{vertexShader:{repr(BG_VERT)},fragmentShader:{repr(BG_FRAG)},side:THREE.BackSide,uniforms:{{uHue:{{value:P.hue}},uTime:{{value:0}}}}}});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(80,32,32),bgMat));
const cubeMat=new THREE.ShaderMaterial({{vertexShader:{repr(VERTEX_SHADER)},fragmentShader:{repr(FRAGMENT_SHADER)},transparent:true,side:THREE.DoubleSide,uniforms:{{uHue:{{value:P.hue}},uTransparency:{{value:P.transparency}},uNoiseAmp:{{value:P.noiseAmplitude}},uTime:{{value:0}}}}}});
const cube=new THREE.Mesh(buildGeometry(P.shape),cubeMat);
scene.add(cube);
const glowMat=new THREE.ShaderMaterial({{vertexShader:{repr(GLOW_VERT)},fragmentShader:{repr(GLOW_FRAG)},transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,uniforms:{{uHue:{{value:P.hue}}}}}});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.55,32,32),glowMat));
const MAX=Math.round(P.particleDensity);
const orbR=new Float32Array(MAX),orbT=new Float32Array(MAX),orbPh=new Float32Array(MAX),orbDT=new Float32Array(MAX),orbDP=new Float32Array(MAX);
for(let i=0;i<MAX;i++){{orbR[i]=1.4+Math.random()*1.2;orbT[i]=Math.random()*Math.PI*2;orbPh[i]=Math.random()*Math.PI;orbDT[i]=(Math.random()-.5)*.012;orbDP[i]=(Math.random()-.5)*.008;}}
const pos=new Float32Array(MAX*3),sz=new Float32Array(MAX);
for(let i=0;i<MAX;i++)sz[i]=1.5+Math.random()*2.5;
const pGeo=new THREE.BufferGeometry();
pGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));
pGeo.setAttribute('aSize',new THREE.BufferAttribute(sz,1));
const pMat=new THREE.ShaderMaterial({{vertexShader:`attribute float aSize;uniform float uTime;varying float vAlpha;void main(){{vAlpha=.6+.4*sin(uTime+position.x*3.);vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aSize*(180./-mv.z);gl_Position=projectionMatrix*mv;}}`,fragmentShader:`uniform float uHue;varying float vAlpha;vec3 hsl2rgb(float h,float s,float l){{float c=(1.-abs(2.*l-1.))*s;float hp=h/60.;float x=c*(1.-abs(mod(hp,2.)-1.));vec3 rgb;if(hp<1.)rgb=vec3(c,x,0.);else if(hp<2.)rgb=vec3(x,c,0.);else if(hp<3.)rgb=vec3(0.,c,x);else if(hp<4.)rgb=vec3(0.,x,c);else if(hp<5.)rgb=vec3(x,0.,c);else rgb=vec3(c,0.,x);return rgb+(l-c*.5);}}void main(){{vec2 uv=gl_PointCoord-.5;if(length(uv)>.5)discard;float a=smoothstep(.5,.1,length(uv))*vAlpha;gl_FragColor=vec4(hsl2rgb(uHue,1.,.72),a*.75);}}`,transparent:true,depthWrite:false,uniforms:{{uHue:{{value:P.hue}},uTime:{{value:0}}}}}});
const pts=new THREE.Points(pGeo,pMat);scene.add(pts);
const clock=new THREE.Clock();
function tick(){{requestAnimationFrame(tick);const t=clock.getElapsedTime();
cubeMat.uniforms.uTime.value=t;bgMat.uniforms.uTime.value=t;pMat.uniforms.uTime.value=t;
cube.rotation.y=t*P.rotationSpeed*.25;cube.rotation.x=Math.sin(t*.18)*.12;
for(let i=0;i<MAX;i++){{orbT[i]+=orbDT[i];orbPh[i]+=orbDP[i];const r=orbR[i];const st=Math.sin(orbT[i]);const ct=Math.cos(orbT[i]);const sp=Math.sin(orbPh[i]);const cp=Math.cos(orbPh[i]);pos[i*3]=r*st*cp;pos[i*3+1]=r*st*sp;pos[i*3+2]=r*ct;}}
pGeo.attributes.position.needsUpdate=true;
renderer.render(scene,camera);}}
tick();
window.addEventListener('resize',()=>{{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}});
</script>
</body>
</html>"""
