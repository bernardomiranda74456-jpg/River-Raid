/**
 * Cheap GPU capability heuristics used to pick a default graphics preset.
 * We look at the unmasked renderer string (when exposed), device memory,
 * CPU cores, touch support and screen size. It is a guess, never exact.
 */
export function detectGPU() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  let renderer = 'unknown', vendor = 'unknown';
  if (gl) {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || renderer;
      vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || vendor;
    } else {
      renderer = gl.getParameter(gl.RENDERER) || renderer;
    }
  }
  const r = String(renderer).toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 1100);
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const software = /swiftshader|llvmpipe|software|mesa offscreen/.test(r);
  const dedicated = /nvidia|geforce|rtx|gtx|radeon rx|radeon pro|rx \d{3,4}|arc a\d|apple m\d/.test(r);
  const integratedWeak = /intel\(r\) (hd|uhd) graphics (4|5|6)\d{2}|mali-4|adreno 5|powervr/.test(r);
  const appleIntegrated = /apple gpu|apple m1|apple m2|apple m3|apple m4/.test(r);
  const appleIntegratedNoMetal = appleIntegrated && isMobile;

  let preset = 'high';
  if (software) preset = 'low';
  else if (isMobile) preset = (mem >= 6 && cores >= 6 && appleIntegratedNoMetal) ? 'medium' : 'low';
  else if (dedicated && mem >= 8) preset = 'ultra';
  else if (integratedWeak || mem <= 4) preset = 'medium';
  else preset = 'high';

  return { renderer: String(renderer), vendor: String(vendor), isMobile, mem, cores, software, preset, webgl2: !!(gl && gl instanceof WebGL2RenderingContext) };
}
