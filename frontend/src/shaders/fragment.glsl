uniform float uHue;
uniform float uTransparency;
uniform float uTime;

varying vec3 vPosition;
varying vec3 vNormal;

// HSL to RGB conversion
vec3 hsl2rgb(float h, float s, float l) {
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float hp = h / 60.0;
  float x = c * (1.0 - abs(mod(hp, 2.0) - 1.0));
  vec3 rgb;

  if (hp < 1.0)      rgb = vec3(c, x, 0.0);
  else if (hp < 2.0) rgb = vec3(x, c, 0.0);
  else if (hp < 3.0) rgb = vec3(0.0, c, x);
  else if (hp < 4.0) rgb = vec3(0.0, x, c);
  else if (hp < 5.0) rgb = vec3(x, 0.0, c);
  else               rgb = vec3(c, 0.0, x);

  float m = l - c * 0.5;
  return rgb + m;
}

void main() {
  // Slight variation based on position for depth
  float hueShift = sin(vPosition.x * 2.0 + uTime * 0.5) * 15.0;
  float hue = mod(uHue + hueShift, 360.0);

  // Fresnel-like edge glow
  vec3 viewDir = normalize(cameraPosition - vPosition);
  float fresnel = 1.0 - abs(dot(viewDir, vNormal));
  fresnel = pow(fresnel, 2.0);

  // Iridescence: hue shifts with viewing angle and time
  float iriAngle = fresnel * 2.5 + uTime * 0.3;
  float iriHue = mod(hue + sin(iriAngle) * 45.0, 360.0);
  vec3 iriColor = hsl2rgb(iriHue, 1.0, 0.62);

  // Rim lighting: tight bright glow at silhouette
  float rim = pow(fresnel, 1.5);
  vec3 rimColor = hsl2rgb(mod(hue + 60.0, 360.0), 1.0, 0.82);

  // Compose layers
  vec3 baseColor = hsl2rgb(hue, 0.8, 0.45);
  vec3 color = mix(baseColor, iriColor, 0.35);
  color = mix(color, rimColor, rim * 0.55);
  color += rimColor * pow(fresnel, 4.5) * 0.4;

  float alpha = (1.0 - uTransparency) * (0.5 + fresnel * 0.5);
  gl_FragColor = vec4(color, alpha);
}
