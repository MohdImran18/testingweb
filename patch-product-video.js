const fs = require("fs");

function patch(file, edits) {
  let s = fs.readFileSync(file, "utf8");
  for (const [name, pattern, replacement] of edits) {
    if (!pattern.test(s)) throw new Error(`${file}: marker not found: ${name}`);
    s = s.replace(pattern, replacement);
  }
  fs.writeFileSync(file, s, "utf8");
  console.log("Patched:", file);
}

patch("server.js", [
  ["readBody limit", /function readBody\(req\) \{[\s\S]*?\n\}/, `function readBody(req, maxBytes = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let body = ''; let failed = false;
    req.on('data', chunk => {
      if (failed) return;
      body += chunk;
      if (Buffer.byteLength(body) > maxBytes) {
        failed = true; reject(new Error('Request body too large')); req.resume();
      }
    });
    req.on('end', () => {
      if (failed) return;
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}`],
  ["public site image response", /return json\(res, 200, \{ images: overrides\.map\(\(\{ id, url \}\) => \(\{ id, url \}\)\) \}\);/, "return json(res, 200, { images: overrides.map(({ id, url, videoUrl }) => ({ id, url, videoUrl: videoUrl || '' })) });"],
  ["admin site image response", /return json\(res,200,\{ images: manifest\.map\(item => \(\{ \.\.\.item, url: overrides\.find\(entry => entry\.id === item\.id\)\?\.url \|\| '' \}\)\) \}\);/, "return json(res,200,{ images: manifest.map(item => { const saved = overrides.find(entry => entry.id === item.id) || {}; return { ...item, url: saved.url || '', videoUrl: saved.videoUrl || '' }; }) });"],
  ["site image PUT route", /if \(method === 'PUT' && pathname === '\/api\/admin\/site-images'\) \{[\s\S]*?\n    \}/, `if (method === 'PUT' && pathname === '/api/admin/site-images') {
      if (!canContent) return json(res,403,{error:'Content management permission required.'});
      const body = await readBody(req);
      const id = clean(body.id,240);
      const manifest = readJsonFile(SITE_IMAGE_MANIFEST, []);
      if (!manifest.some(item => item.id === id)) return json(res,404,{error:'Image slot not found.'});

      const hasUrl = Object.prototype.hasOwnProperty.call(body, 'url');
      const hasVideo = Object.prototype.hasOwnProperty.call(body, 'videoUrl');
      if (!hasUrl && !hasVideo) return json(res,400,{error:'No media field supplied.'});

      const urlValue = hasUrl ? clean(body.url,800) : undefined;
      const videoValue = hasVideo ? clean(body.videoUrl,800) : undefined;
      const validUpload = value => !value || /^\\/api\\/uploads\\/[a-f0-9-]{20,80}$/i.test(value);
      if (hasUrl && !validUpload(urlValue)) return json(res,400,{error:'Choose an image uploaded to the media library.'});
      if (hasVideo && !validUpload(videoValue)) return json(res,400,{error:'Choose a video uploaded to the media library.'});

      const existing = await getRecord('siteImages', id);
      const record = { ...(existing || {}), id, updatedAt: new Date().toISOString(), updatedBy: user.email };
      if (hasUrl) record.url = urlValue;
      if (hasVideo) record.videoUrl = videoValue;
      if (!record.url && !record.videoUrl) await deleteRecord('siteImages',id);
      else await putRecord('siteImages',record);

      await logActivity(user, (hasVideo ? videoValue : urlValue) ? 'updated' : 'reset', 'site_image', id);
      return json(res,200,{ok:true,id,url:record.url || '',videoUrl:record.videoUrl || ''});
    }`],
  ["upload route", /if \(method === 'POST' && pathname === '\/api\/admin\/uploads'\) \{[\s\S]*?\n    \}/, `if (method === 'POST' && pathname === '/api/admin/uploads') {
      if (!canContent) return json(res,403,{error:'Content management permission required.'});
      const body = await readBody(req, 42 * 1024 * 1024);
      const match = String(body.dataUrl || '').match(/^data:(image\\/(?:jpeg|png|webp|gif)|video\\/(?:mp4|webm|quicktime));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) return json(res,400,{error:'Supported formats: JPG, PNG, WEBP, GIF, MP4, WebM or MOV.'});
      const buffer = Buffer.from(match[2],'base64');
      const isVideo = match[1].startsWith('video/');
      const maxSize = isVideo ? 30 * 1024 * 1024 : 5 * 1024 * 1024;
      if (buffer.length > maxSize) return json(res,413,{error:isVideo ? 'Video must be 30 MB or smaller.' : 'Image must be 5 MB or smaller.'});
      const id = crypto.randomUUID();
      const filename = clean(body.filename,160) || (isVideo ? 'product-video' : 'blog-image');
      if (useDatabase) await pool.query('INSERT INTO admin_media(id,filename,mime_type,data) VALUES($1,$2,$3,$4)',[id,filename,match[1],buffer]);
      else await putRecord('media',{id,filename,mimeType:match[1],data:buffer.toString('base64'),createdAt:new Date().toISOString()});
      return json(res,201,{url:\`/api/uploads/\${id}\`,id});
    }`]
]);

patch("app/admin/page.tsx", [
  ["SiteImage type", /type SiteImage = \{ id:string; page:string; src:string; alt:string; url:string \};/, "type SiteImage = { id:string; page:string; src:string; alt:string; url:string; videoUrl?:string };"],
  ["image and video upload functions", /async function uploadSiteImage\(slot:SiteImage,file\?:File\)\{[\s\S]*?\n  async function resetSiteImage/, `async function uploadSiteImage(slot:SiteImage,file?:File){
    if(!file)return;setBusy(true);setError("");
    try{
      if(!/^image\\/(jpeg|png|webp|gif)$/.test(file.type))throw new Error("Use JPG, PNG, WEBP or GIF images.");
      if(file.size>5*1024*1024)throw new Error("Image must be 5 MB or smaller.");
      const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Could not read image."));reader.readAsDataURL(file);});
      const uploaded=await api<{url:string}>("/api/admin/uploads",{method:"POST",body:JSON.stringify({filename:file.name,dataUrl})});
      await api("/api/admin/site-images",{method:"PUT",body:JSON.stringify({id:slot.id,url:uploaded.url})});
      setSiteImages(prev=>prev.map(item=>item.id===slot.id?{...item,url:uploaded.url}:item));
      setNotice("Website image replaced successfully.");
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function uploadSiteVideo(slot:SiteImage,file?:File){
    if(!file)return;setBusy(true);setError("");
    try{
      if(!/^video\\/(mp4|webm|quicktime)$/.test(file.type))throw new Error("Use MP4, WebM or MOV video.");
      if(file.size>30*1024*1024)throw new Error("Video must be 30 MB or smaller.");
      const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Could not read video."));reader.readAsDataURL(file);});
      const uploaded=await api<{url:string}>("/api/admin/uploads",{method:"POST",body:JSON.stringify({filename:file.name,dataUrl})});
      await api("/api/admin/site-images",{method:"PUT",body:JSON.stringify({id:slot.id,videoUrl:uploaded.url})});
      setSiteImages(prev=>prev.map(item=>item.id===slot.id?{...item,videoUrl:uploaded.url}:item));
      setNotice("Product video uploaded successfully.");
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function resetSiteVideo(slot:SiteImage){
    setBusy(true);setError("");
    try{
      await api("/api/admin/site-images",{method:"PUT",body:JSON.stringify({id:slot.id,videoUrl:""})});
      setSiteImages(prev=>prev.map(item=>item.id===slot.id?{...item,videoUrl:""}:item));
      setNotice("Product video removed. Image fallback restored.");
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function resetSiteImage`],
  ["Image Manager video controls", /<div className="cb-site-image-actions">/, `<div className="cb-site-image-actions">`],
  ["Insert product video controls", /<label className="cb-admin-primary compact"><ImagePlus size=\{14\}\/> Upload replacement<input type="file" accept="image\/png,image\/jpeg,image\/webp,image\/gif" hidden onChange=\{e=>uploadSiteImage\(slot,e\.target\.files\?\.\[0\]\)\}\/><\/label>\{slot\.url&&<button className="cb-admin-secondary compact" disabled=\{busy\} onClick=\{\(\)=>resetSiteImage\(slot\)\}>Restore original<\/button>\}/,
   `<label className="cb-admin-primary compact"><ImagePlus size={14}/> Upload replacement<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e=>uploadSiteImage(slot,e.target.files?.[0])}/></label>{slot.url&&<button className="cb-admin-secondary compact" disabled={busy} onClick={()=>resetSiteImage(slot)}>Restore original</button>}{slot.id.startsWith("products.html::")&&<><label className="cb-admin-primary compact">Upload / Replace Video<input type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={e=>uploadSiteVideo(slot,e.target.files?.[0])}/></label>{slot.videoUrl&&<button className="cb-admin-secondary compact" disabled={busy} onClick={()=>resetSiteVideo(slot)}>Remove Video</button>}</>}`],
  ["Admin video preview", /<div className="cb-site-image-preview">/, `{slot.id.startsWith("products.html::")&&slot.videoUrl&&<video className="cb-site-image-video-preview" src={slot.videoUrl} controls playsInline preload="metadata"/>}<div className="cb-site-image-preview">`]
]);

patch("public/original/products.html", [
  ["product video CSS", /\.product-image img\{width:100%;height:390px;object-fit:cover;display:block\}/, ".product-image img{width:100%;height:390px;object-fit:cover;display:block}.product-image video{width:100%;height:390px;object-fit:cover;display:block;background:#092c3b}"],
  ["mobile video CSS", /\.hero-art img,\.product-image img\{height:270px\}/, ".hero-art img,.product-image img,.product-image video{height:270px}"],
  ["expanded video CSS", /\.product\.product-expanded \.product-image img \{[\s\S]*?display: block;\n\}/, m => m + "\n.product.product-expanded .product-image video{width:100%;height:390px;object-fit:cover;display:block;background:#092c3b}"],
  ["mobile expanded video CSS", /\.product\.product-expanded \.product-image img \{ height: 270px; \}/, ".product.product-expanded .product-image img,.product.product-expanded .product-image video { height: 270px; }"],
  ["product image/video loader", /\/\* Admin Image Manager: product image replacements \*\/[\s\S]*?\}\)\(\);\n/, `/* Admin Image Manager: product image and video replacements */
(function () {
  fetch("/api/public/site-images", { credentials: "same-origin" })
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (result) {
      if (!result || !Array.isArray(result.images)) return;
      var replacements = new Map(result.images.map(function (item) {
        return [item.id, item];
      }));

      document.querySelectorAll("img[data-cb-image-key]").forEach(function (img) {
        var media = replacements.get(img.getAttribute("data-cb-image-key"));
        if (media && media.url) img.src = media.url;
      });

      document.querySelectorAll(".product.product-collapsed .product-image img[data-cb-image-key]").forEach(function (img) {
        var media = replacements.get(img.getAttribute("data-cb-image-key"));
        if (!media || !media.videoUrl) return;
        var video = document.createElement("video");
        video.src = media.videoUrl;
        video.controls = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.setAttribute("aria-label", img.alt || "Product video");
        if (media.url) video.poster = media.url;
        img.parentNode.replaceChild(video, img);
      });
    })
    .catch(function (error) {
      console.warn("Product media overrides could not be loaded.", error);
    });
})();
`]
]);

console.log("All product video patches completed.");
