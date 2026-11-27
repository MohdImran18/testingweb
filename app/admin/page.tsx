"use client";
import "./admin.css";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity, ArrowDownToLine, ArrowUpRight, Bell, BookOpen, Check, ChevronDown, CirclePlus, Images,
  Clock3, FileText, Globe, ImagePlus, LayoutDashboard, LogOut, Mail, Menu, Pencil, Plus,
  RefreshCw, Save, Search, Send, Settings, Shield, SlidersHorizontal, Sparkles, Tag,
  Trash2, Users, X, Eye, CheckCircle2, AlertCircle, LoaderCircle
} from "lucide-react";

type User = { id: string; email: string; name: string; role: "super_admin"|"sales"|"marketing"; active: boolean };
type Lead = { id: string; fullName: string; email: string; phone: string; company?: string; country?: string; region?: string; useCase?: string; projectDetails?: string; comments?: string; source?: string; sourcePage?: string; formType?: string; status: string; assignedTo?: string; followUpAt?: string; createdAt: string; emailNotification?: string; notes?: {id:string;text:string;createdAt:string;by?:string}[] };
type Blog = { id: string; title: string; slug: string; excerpt: string; content: string; featuredImage: string; imageAlt: string; category: string; tags: string[]; author: string; status: string; publishAt: string; updatedAt?: string; seo?: Record<string,string> };
type Category = { id:string; name:string; slug:string };
type SeoPage = { id:string; path:string; fields: Record<string,string> };
type SiteImage = { id:string; page:string; src:string; alt:string; url:string; videoUrl?:string };
type Project = { id:string; title:string; slug:string; location:string; category:string; summary:string; image:string; videoUrl:string; detailUrl:string; status:string; updatedAt?:string };
type Section = "overview"|"leads"|"projects"|"blogs"|"images"|"seo"|"users"|"settings";

const statuses = ["new","contacted","qualified","proposal_sent","negotiation","won","lost"];
const statusLabels: Record<string,string> = {new:"New",contacted:"Contacted",qualified:"Qualified",proposal_sent:"Proposal sent",negotiation:"Negotiation",won:"Won",lost:"Lost"};
const pageOptions = ["/","/about.html","/contact.html","/services.html","/projects.html","/class-1.html","/class-2.html","/class-3.html","/alligator.html","/deployment-models.html","/service-bathymetric-survey.html","/service-draft-survey.html","/service-hyacinth-removal.html","/service-solid-waste-recovery.html","/project-falgu-river-gaya.html","/project-hong-kong-oil-response.html","/project-ilugin-river-philippines.html","/project-jnpa-mumbai.html","/project-lohagarh-fort-bharatpur.html","/project-nonbah-river-meghalaya.html","/project-putiya-kavin-chira-kerala.html","/project-sentx-landfill-hong-kong.html","/project-sino-group-hong-kong.html","/project-umiam-lake-meghalaya.html","/blog.html"];
const emptyBlog = (): Blog => ({id:"",title:"",slug:"",excerpt:"",content:"",featuredImage:"",imageAlt:"",category:"",tags:[],author:"",status:"draft",publishAt:"",seo:{title:"",description:"",keywords:""}});
const emptyLead = {fullName:"",email:"",phone:"",company:"",country:"",region:"",useCase:"",source:"manual"};

async function api<T=any>(url:string, options:RequestInit={}):Promise<T> {
  const response = await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})},credentials:"same-origin"});
  const data = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}
function dateText(value?:string) { if(!value) return "—"; const d=new Date(value); return Number.isNaN(d.getTime())?value:d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); }
function makeSlug(value:string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }
function imagePageTitle(page:string) {
  if(page === "index.html") return "Homepage";
  if(page === "about.html" ) return "About Us";
  const base=page.replace(/\.html$/i,"").replace(/^(project|service)-/i,"$1 — ").replace(/-/g," ");
  return base.replace(/\b\w/g,letter=>letter.toUpperCase());
}
function imageSource(slot:SiteImage) {
  if (!slot || typeof slot.src !== "string" || !slot.src.trim()) return "";
  if (typeof slot.url === "string" && slot.url) return slot.url;
  if (/^(https?:|data:|blob:)/i.test(slot.src)) return slot.src;
  return `/${slot.src.replace(/^\.\//,"").replace(/^\//,"")}`;
}
function formatBytes(bytes:number) {
  if(!Number.isFinite(bytes)||bytes<0) return "—";
  if(bytes<1024) return `${bytes} B`;
  if(bytes<1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/(1024*1024)).toFixed(2)} MB`;
}
function imageFormat(src:string) {
  const dataMime=src.match(/^data:image\/([^;,]+)/i)?.[1];
  if(dataMime) return dataMime.toUpperCase().replace("JPEG","JPG");
  try {
    const path=new URL(src,typeof window!=="undefined"?window.location.origin:"https://clearbot.invalid").pathname;
    const ext=path.split(".").pop()||"image";
    return ext.toUpperCase()==="JPEG"?"JPG":ext.toUpperCase();
  } catch { return "IMAGE"; }
}

const homeHeroSlideNames=["Waterway cleanup","Alligator Neo","Class 2 Skimmer","Class 3 Skimmer","Fetch Skimmer"];
function heroSlideNumber(slot:SiteImage){
  if(slot.page!=="index.html") return 0;
  const match=slot.id.match(/^index\.html::([1-5])$/);
  return match?Number(match[1]):0;
}
function imageRequirement(slot:SiteImage){
  const slide=heroSlideNumber(slot);
  if(slide) return {size:"1920 × 900 px",detail:"Homepage hero slider · wide 2.13:1 crop",minimumWidth:1920};
  const alt=(slot.alt||"").toLowerCase();
  if(/youtube|video|thumbnail/.test(alt)||/ytimg\.com/.test(slot.src)) return {size:"1280 × 720 px",detail:"Video thumbnail · 16:9 crop",minimumWidth:1280};
  if(/logo|partner|client/.test(alt)||/logo|partner|client/i.test(slot.src)||/\.svg(?:$|\?)/i.test(slot.src)) return {size:"SVG or 600 × 300 px PNG",detail:"Transparent logo artwork",minimumWidth:600};
  return {size:"1200 px wide minimum",detail:"Keep the original image aspect ratio",minimumWidth:1200};
}
function imageResolutionStatus(slot:SiteImage,actual:string){
  const width=Number((actual||"").match(/^([\d,]+)/)?.[1]?.replace(/,/g,""));
  if(!width) return "Checking actual resolution";
  return width>=imageRequirement(slot).minimumWidth?"Meets recommendation":"Below recommendation";
}

export default function AdminPage() {
  const [user,setUser]=useState<User|null>(null);
  const [section,setSection]=useState<Section>("overview");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [dashboard,setDashboard]=useState<any>(null);
  const [settings,setSettings]=useState<any>(null);
  const [leads,setLeads]=useState<Lead[]>([]);
  const [leadSearch,setLeadSearch]=useState("");
  const [leadStatus,setLeadStatus]=useState("all");
  const [selectedLead,setSelectedLead]=useState<Lead|null>(null);
  const [manualOpen,setManualOpen]=useState(false);
  const [manual,setManual]=useState({...emptyLead});
  const [leadNote,setLeadNote]=useState("");
  const [followUp,setFollowUp]=useState("");
  const [blogs,setBlogs]=useState<Blog[]>([]);
  const [projects,setProjects]=useState<Project[]>([]);
  const emptyProject=():Project=>({id:"",title:"",slug:"",location:"",category:"",summary:"",image:"",videoUrl:"",detailUrl:"",status:"draft"});
  const [project,setProject]=useState<Project>(emptyProject());
  const [editingProject,setEditingProject]=useState(false);
  const [siteImages,setSiteImages]=useState<SiteImage[]>([]);
  const [imageDimensions,setImageDimensions]=useState<Record<string,string>>({});
  const [imageFileSizes,setImageFileSizes]=useState<Record<string,string>>({});
  const [siteImageSearch,setSiteImageSearch]=useState("");
  const [categories,setCategories]=useState<Category[]>([]);
  const [blog,setBlog]=useState<Blog>(emptyBlog());
  const [editingBlog,setEditingBlog]=useState(false);
  const [categoryName,setCategoryName]=useState("");
  const editorRef=useRef<HTMLDivElement>(null);
  const [seoPages,setSeoPages]=useState<SeoPage[]>([]);
  const [seoPath,setSeoPath]=useState("/");
  const [seoForm,setSeoForm]=useState({title:"",description:"",keywords:"",canonical:"",robots:"index,follow",ogTitle:"",ogDescription:"",ogImage:""});
  const [users,setUsers]=useState<User[]>([]);
  const [newUser,setNewUser]=useState({name:"",email:"",password:"",role:"sales"});
  const [newUserOpen,setNewUserOpen]=useState(false);

  const canLeads=user?.role==="super_admin"||user?.role==="sales";
  const canContent=user?.role==="super_admin"||user?.role==="marketing";
  const isSuper=user?.role==="super_admin";

  const loadAll=useCallback(async()=>{
    setError("");
    const me=await api<{user:User}>("/api/admin/auth/me"); setUser(me.user);
    const base=await Promise.all([api("/api/admin/dashboard"),api("/api/admin/settings")]); setDashboard(base[0]); setSettings(base[1]);
    if(me.user.role!=="marketing") { const l=await api<{leads:Lead[]}>("/api/admin/leads"); setLeads(l.leads); }
    if(me.user.role!=="sales") { const [b,p,c,s,im]=await Promise.all([api<{blogs:Blog[]}>("/api/admin/blogs"),api<{projects:Project[]}>("/api/admin/projects"),api<{categories:Category[]}>("/api/admin/categories"),api<{pages:SeoPage[]}>("/api/admin/seo"),api<{images:SiteImage[]}>("/api/admin/site-images")]); setBlogs(b.blogs); setProjects(p.projects); setCategories(c.categories); setSeoPages(s.pages); setSiteImages(im.images); }
    if(me.user.role==="super_admin") { const u=await api<{users:User[]}>("/api/admin/users"); setUsers(u.users); }
  },[]);

  useEffect(()=>{loadAll().catch(()=>{window.location.href="/admin/login";}).finally(()=>setLoading(false));},[loadAll]);
  useEffect(()=>{if(notice){const t=setTimeout(()=>setNotice(""),4000);return()=>clearTimeout(t);}},[notice]);
  useEffect(()=>{const selected=seoPages.find(p=>p.path===seoPath);setSeoForm({...{title:"",description:"",keywords:"",canonical:"",robots:"index,follow",ogTitle:"",ogDescription:"",ogImage:""},...(selected?.fields||{})});},[seoPath,seoPages]);
  useEffect(()=>{if(editorRef.current && editingBlog) editorRef.current.innerHTML=blog.content||"";},[editingBlog,blog.id]);

  async function refreshLeads(){const r=await api<{leads:Lead[]}>(`/api/admin/leads?status=${encodeURIComponent(leadStatus)}&q=${encodeURIComponent(leadSearch)}`);setLeads(r.leads);}
  async function openLead(lead:Lead){setSelectedLead(lead);setFollowUp(lead.followUpAt||"");setLeadNote("");}
  async function saveLeadPatch(id:string,patch:any){setBusy(true);setError("");try{const r=await api<{lead:Lead}>(`/api/admin/leads/${id}`,{method:"PATCH",body:JSON.stringify(patch)});setLeads(prev=>prev.map(x=>x.id===id?r.lead:x));setSelectedLead(r.lead);setNotice("Lead updated successfully.");}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function addManualLead(e:FormEvent){e.preventDefault();setBusy(true);setError("");try{await api("/api/admin/leads",{method:"POST",body:JSON.stringify(manual)});setManual({...emptyLead});setManualOpen(false);await refreshLeads();const d=await api("/api/admin/dashboard");setDashboard(d);setNotice("Manual enquiry saved. Check its notification status in the lead details.");}catch(err){setError((err as Error).message);}finally{setBusy(false);}}
  function exportCsv(){const rows=["Enquiry ID,Name,Email,Phone,Company,Country,Source,Status,Created At",...leads.map(l=>[l.id,l.fullName,l.email,l.phone,l.company,l.country,l.source,l.status,l.createdAt].map(v=>`"${String(v||"").replace(/"/g,'""')}"`).join(","))];const blob=new Blob([rows.join("\n")],{type:"text/csv;charset=utf-8"});const href=URL.createObjectURL(blob);const a=document.createElement("a");a.href=href;a.download="clearbot-leads.csv";a.click();URL.revokeObjectURL(href);}

  async function saveProject(e:FormEvent){
    e.preventDefault();
    if(!project.title.trim()){setError("Please enter a project title.");return;}
    setBusy(true);setError("");
    try{
      const payload={...project,slug:project.slug||makeSlug(project.title)};
      const result=await api<{project:Project}>(project.id?`/api/admin/projects/${encodeURIComponent(project.id)}`:"/api/admin/projects",{method:project.id?"PATCH":"POST",body:JSON.stringify(payload)});
      setProjects(prev=>project.id?prev.map(p=>p.id===result.project.id?result.project:p):[result.project,...prev]);
      setProject(emptyProject());setEditingProject(false);setNotice("Project saved successfully.");
    }catch(err){setError((err as Error).message);}finally{setBusy(false);}
  }
  async function deleteProject(item:Project){
    if(!window.confirm(`Delete "${item.title}"? This removes it from Admin and the public Projects page.`))return;
    setBusy(true);setError("");
    try{await api(`/api/admin/projects/${encodeURIComponent(item.id)}`,{method:"DELETE"});setProjects(prev=>prev.filter(p=>p.id!==item.id));setNotice("Project deleted.");}
    catch(err){setError((err as Error).message);}finally{setBusy(false);}
  }
  async function toggleProject(item:Project){
    setBusy(true);setError("");
    try{const r=await api<{project:Project}>(`/api/admin/projects/${encodeURIComponent(item.id)}`,{method:"PATCH",body:JSON.stringify({status:item.status==="published"?"draft":"published"})});setProjects(prev=>prev.map(p=>p.id===item.id?r.project:p));setNotice(r.project.status==="published"?"Project published.":"Project unpublished.");}
    catch(err){setError((err as Error).message);}finally{setBusy(false);}
  }

  function createBlog(){setBlog(emptyBlog());setEditingBlog(true);setSection("blogs");}
  function editBlog(item:Blog){setBlog({...item,seo:item.seo||{title:"",description:"",keywords:""}});setEditingBlog(true);}
  async function saveBlog(status?:string){const content=editorRef.current?.innerHTML||blog.content;const payload={...blog,content,status:status||blog.status,slug:blog.slug||makeSlug(blog.title),author:blog.author||user?.name};if(!payload.title.trim()){setError("Please enter a blog title.");return;}setBusy(true);setError("");try{let result;if(blog.id) result=await api<{blog:Blog}>(`/api/admin/blogs/${blog.id}`,{method:"PATCH",body:JSON.stringify(payload)});else result=await api<{blog:Blog}>("/api/admin/blogs",{method:"POST",body:JSON.stringify(payload)});setBlogs(prev=>[result.blog,...prev.filter(b=>b.id!==result.blog.id)]);setBlog(result.blog);setNotice(result.blog.status==="published"?"Blog published successfully.":"Blog draft saved.");setEditingBlog(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function deleteBlog(item:Blog){if(!confirm(`Delete “${item.title}”? This cannot be undone.`))return;try{await api(`/api/admin/blogs/${item.id}`,{method:"DELETE"});setBlogs(prev=>prev.filter(b=>b.id!==item.id));setNotice("Blog deleted.");}catch(e){setError((e as Error).message);}}
  async function addCategory(e:FormEvent){e.preventDefault();if(!categoryName.trim())return;try{const r=await api<{category:Category}>("/api/admin/categories",{method:"POST",body:JSON.stringify({name:categoryName})});setCategories(prev=>[r.category,...prev]);setCategoryName("");setNotice("Category added.");}catch(e){setError((e as Error).message);}}
  async function uploadImage(file?:File){if(!file)return;setBusy(true);setError("");try{const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Could not read image."));reader.readAsDataURL(file);});const r=await api<{url:string}>("/api/admin/uploads",{method:"POST",body:JSON.stringify({filename:file.name,dataUrl})});setBlog(prev=>({...prev,featuredImage:r.url,imageAlt:prev.imageAlt||file.name.replace(/\.[^.]+$/,"")}));setNotice("Image uploaded.");}catch(e){setError((e as Error).message);}finally{setBusy(false);}}

  async function uploadSiteImage(slot:SiteImage,file?:File){
    if(!file)return;setBusy(true);setError("");
    try{
      if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type))throw new Error("Use JPG, PNG, WEBP or GIF images.");
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
      if(!/^video\/(mp4|webm|quicktime)$/.test(file.type))throw new Error("Use MP4, WebM or MOV video.");
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
  async function resetSiteImage(slot:SiteImage){setBusy(true);try{await api("/api/admin/site-images",{method:"PUT",body:JSON.stringify({id:slot.id,url:""})});setSiteImages(prev=>prev.map(item=>item.id===slot.id?{...item,url:""}:item));setNotice("Original image restored.");}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function recordSiteImageMeta(slot:SiteImage,img:HTMLImageElement){
    const width=img.naturalWidth; const height=img.naturalHeight;
    if(width&&height) setImageDimensions(prev=>({...prev,[slot.id]:`${width.toLocaleString()} × ${height.toLocaleString()} px · ${(width/height).toFixed(2)}:1`}));
    const src=img.currentSrc||imageSource(slot);
    if(/^data:image\//i.test(src)){
      const comma=src.indexOf(","); const payload=src.slice(comma+1);
      const bytes=/;base64,/i.test(src)?Math.max(0,Math.floor(payload.length*3/4)-(payload.endsWith("==")?2:payload.endsWith("=")?1:0)):new Blob([decodeURIComponent(payload)]).size;
      setImageFileSizes(prev=>({...prev,[slot.id]:formatBytes(bytes)}));
      return;
    }
    try{
      const parsed=new URL(src,window.location.href);
      if(parsed.origin!==window.location.origin){setImageFileSizes(prev=>({...prev,[slot.id]:"External CDN"}));return;}
      const response=await fetch(parsed.toString(),{method:"HEAD",credentials:"same-origin",cache:"force-cache"});
      const length=Number(response.headers.get("content-length")||0);
      if(response.ok&&length>0){setImageFileSizes(prev=>({...prev,[slot.id]:formatBytes(length)}));return;}
      const fallback=await fetch(parsed.toString(),{credentials:"same-origin",cache:"force-cache"});
      if(fallback.ok){const blob=await fallback.blob();setImageFileSizes(prev=>({...prev,[slot.id]:formatBytes(blob.size)}));return;}
      setImageFileSizes(prev=>({...prev,[slot.id]:"Size unavailable"}));
    }catch{setImageFileSizes(prev=>({...prev,[slot.id]:"External / unavailable"}));}
  }
  async function saveSeo(e:FormEvent){e.preventDefault();setBusy(true);setError("");try{const r=await api<{seo:SeoPage}>("/api/admin/seo",{method:"PUT",body:JSON.stringify({path:seoPath,...seoForm})});setSeoPages(prev=>[r.seo,...prev.filter(p=>p.path!==seoPath)]);setNotice("SEO settings saved for "+seoPath);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function addUser(e:FormEvent){e.preventDefault();setBusy(true);setError("");try{const r=await api<{user:User}>("/api/admin/users",{method:"POST",body:JSON.stringify(newUser)});setUsers(prev=>[r.user,...prev]);setNewUser({name:"",email:"",password:"",role:"sales"});setNewUserOpen(false);setNotice("User account created.");}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function toggleUser(u:User){try{const r=await api<{user:User}>(`/api/admin/users/${u.id}`,{method:"PATCH",body:JSON.stringify({active:!u.active})});setUsers(prev=>prev.map(v=>v.id===u.id?r.user:v));}catch(e){setError((e as Error).message);}}
  async function logout(){await api("/api/admin/auth/logout",{method:"POST",body:"{}"}).catch(()=>{});window.location.href="/admin/login";}
  async function refresh(){setBusy(true);try{await loadAll();setNotice("Dashboard refreshed.");}catch(e){setError((e as Error).message);}finally{setBusy(false);}}

  const filteredLeads=useMemo(()=>leads.filter(l=>(leadStatus==="all"||l.status===leadStatus)&&(!leadSearch||[l.fullName,l.email,l.company,l.country,l.phone].some(v=>String(v||"").toLowerCase().includes(leadSearch.toLowerCase())))),[leads,leadStatus,leadSearch]);
  const groupedSiteImages=useMemo(()=>{
    const pageOrder=[
      "Homepage Hero Slider","index.html","about.html","products.html","projects.html",
      "class-1.html","class-2.html","class-3.html","alligator.html",
      "deployment-models.html","services.html",
      "service-bathymetric-survey.html","service-draft-survey.html",
      "service-hyacinth-removal.html","service-solid-waste-recovery.html",
      "project-falgu-river-gaya.html","project-hong-kong-oil-response.html",
      "project-ilugin-river-philippines.html","project-jnpa-mumbai.html",
      "project-lohagarh-fort-bharatpur.html","project-nonbah-river-meghalaya.html",
      "project-putiya-kavin-chira-kerala.html","project-sentx-landfill-hong-kong.html",
      "project-sino-group-hong-kong.html","project-umiam-lake-meghalaya.html",
      "blog.html","news.html","blog-complete-waterway-fleet.html",
      "blog-diesel-to-digital.html","blog-digital-twins.html",
      "blog-service-based-management.html","contact.html"
    ];

    // Normalize normal records and flatten malformed numeric-key containers.
    const flatSlots: SiteImage[] = [];

    const collectSlots = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(collectSlots);
        return;
      }

      if (!value || typeof value !== "object") return;

      const item = value as Partial<SiteImage>;

      if (
        typeof item.id === "string" &&
        typeof item.page === "string" &&
        typeof item.src === "string"
      ) {
        flatSlots.push({
          id: item.id,
          page: item.page,
          src: item.src,
          alt: typeof item.alt === "string" ? item.alt : "",
          url: typeof item.url === "string" ? item.url : "",
          videoUrl: typeof item.videoUrl === "string" ? item.videoUrl : ""
        });
        return;
      }

      Object.values(value as Record<string, unknown>).forEach(child => {
        if (child && typeof child === "object") collectSlots(child);
      });
    };

    (siteImages as unknown[]).forEach(collectSlots);

    const uniqueSlots = Array.from(
      new Map(flatSlots.map(slot => [slot.id, slot])).values()
    );

    const order = new Map(pageOrder.map((page,index) => [page,index]));
    const query = siteImageSearch.trim().toLowerCase();

    const filtered = uniqueSlots.filter(slot => {
      const slide = heroSlideNumber(slot);
      return !query || [
        slot.page,
        slot.alt,
        slot.src,
        slide ? "homepage hero slider" : ""
      ].some(value => String(value || "").toLowerCase().includes(query));
    });

    const grouped = new Map<string,SiteImage[]>();

    for (const slot of filtered) {
      const key = heroSlideNumber(slot)
        ? "Homepage Hero Slider"
        : (slot.page || "Other pages");

      if (!grouped.has(key)) grouped.set(key,[]);
      grouped.get(key)!.push(slot);
    }

    return Array.from(grouped.entries()).sort(
      ([a],[b]) => (order.get(a) ?? 999) - (order.get(b) ?? 999)
        || a.localeCompare(b)
    );
  },[siteImages,siteImageSearch]);
  const tabs=[{id:"overview" as Section,label:"Overview",icon:LayoutDashboard,show:true},{id:"leads" as Section,label:"Leads & enquiries",icon:Users,show:canLeads},{id:"projects" as Section,label:"Projects manager",icon:FileText,show:canContent},{id:"blogs" as Section,label:"Blog manager",icon:BookOpen,show:canContent},{id:"images" as Section,label:"Image manager",icon:Images,show:canContent},{id:"seo" as Section,label:"SEO manager",icon:Globe,show:canContent},{id:"users" as Section,label:"User access",icon:Shield,show:isSuper},{id:"settings" as Section,label:"Settings",icon:Settings,show:true}].filter(t=>t.show);

  if(loading)return <div className="cb-admin-loading"><LoaderCircle className="spin" size={25}/> Checking secure admin session…</div>;
  if(!user)return null;

  return <div className="cb-admin-shell">
    <aside className="cb-admin-sidebar">
      <div className="cb-admin-brand"><div className="cb-admin-mark">C<span>B</span></div><div><b>CLEARBOT</b><small>ADMIN CONSOLE</small></div></div>
      <div className="cb-admin-workspace"><span className="cb-admin-avatar">{user.name.slice(0,1).toUpperCase()}</span><div><b>{user.name}</b><small>{user.role.replace("_"," ")}</small></div><ChevronDown size={15}/></div>
      <div className="cb-admin-nav-label">WORKSPACE</div>
      <nav className="cb-admin-nav">{tabs.map(tab=><button key={tab.id} className={section===tab.id?"active":""} onClick={()=>{setSection(tab.id);setError("");setEditingBlog(false);}}><tab.icon size={17}/>{tab.label}{tab.id==="leads"&&dashboard?.newToday>0&&<span className="cb-admin-nav-count">{dashboard.newToday}</span>}</button>)}</nav>
      <div className="cb-admin-sidebar-bottom"><div className="cb-admin-secure"><Shield size={15}/><span>Secure workspace<br/><small>Role-based access enabled</small></span></div><button className="cb-admin-logout" onClick={logout}><LogOut size={16}/> Sign out</button></div>
    </aside>
    <main className="cb-admin-main">
      <header className="cb-admin-topbar"><div><div className="cb-admin-breadcrumb">CLEARBOT <span>/</span> {section.replace("overview","dashboard").replace("_"," ").toUpperCase()}</div><h1>{section==="overview"?"Dashboard":section==="leads"?"Lead & Enquiry Management":section==="projects"?"Project Management":section==="blogs"?"Blog & Content Manager":section==="images"?"Website Image Manager":section==="seo"?"SEO Management":section==="users"?"User & Role Management":"System Settings"}</h1></div><div className="cb-admin-top-actions"><button className="cb-admin-icon-button" onClick={refresh} title="Refresh"><RefreshCw size={17}/></button><div className="cb-admin-top-user"><span className="cb-admin-avatar small">{user.name.slice(0,1).toUpperCase()}</span><div><b>{user.name}</b><small>{user.email}</small></div></div></div></header>
      {error&&<div className="cb-admin-alert error"><AlertCircle size={17}/>{error}<button onClick={()=>setError("")}><X size={15}/></button></div>}
      {notice&&<div className="cb-admin-alert success"><CheckCircle2 size={17}/>{notice}<button onClick={()=>setNotice("")}><X size={15}/></button></div>}

      {section==="overview"&&<>
        <div className="cb-admin-welcome"><div><span className="cb-admin-kicker">CLEARBOT BUSINESS OVERVIEW</span><h2>Good to see you, {user.name.split(" ")[0]}.</h2><p>Here's what's happening across your website and enquiry pipeline.</p></div><button className="cb-admin-secondary" onClick={refresh}><RefreshCw size={15}/> Refresh data</button></div>
        <div className="cb-admin-stat-grid"><Stat icon={<Users/>} label="Total enquiries" value={dashboard?.totalLeads??"—"} hint="All channels"/><Stat icon={<Sparkles/>} label="New today" value={dashboard?.newToday??"—"} hint="Website + manual"/><Stat icon={<BookOpen/>} label="Published blogs" value={dashboard?.publishedBlogs??"—"} hint={`${dashboard?.drafts??0} drafts`} /><Stat icon={<Activity/>} label="Open pipeline" value={Object.entries(dashboard?.statuses||{}).filter(([k])=>!['won','lost'].includes(k)).reduce((a,[,v])=>a+Number(v),0)} hint="Not yet closed"/></div>
        <div className="cb-admin-grid-two"><section className="cb-admin-card"><div className="cb-admin-card-heading"><div><h3>Enquiry pipeline</h3><p>Lead status distribution</p></div><button onClick={()=>setSection("leads")} className="cb-admin-text-link">View leads <ArrowUpRight size={14}/></button></div><div className="cb-admin-pipeline">{statuses.map(s=><div key={s} className="cb-admin-pipeline-row"><span>{statusLabels[s]}</span><div className="cb-admin-bar"><i style={{width:`${dashboard?.totalLeads?Math.max(2,((dashboard.statuses?.[s]||0)/dashboard.totalLeads)*100):0}%`}}/></div><b>{dashboard?.statuses?.[s]||0}</b></div>)}</div></section><section className="cb-admin-card"><div className="cb-admin-card-heading"><div><h3>Recent enquiries</h3><p>Latest customer submissions</p></div><button onClick={()=>setSection("leads")} className="cb-admin-text-link">Open inbox <ArrowUpRight size={14}/></button></div><div className="cb-admin-recent-list">{(dashboard?.recentLeads||[]).slice(0,6).map((l:Lead)=><button key={l.id} onClick={()=>{setSection("leads");setSelectedLead(l);}} className="cb-admin-recent-row"><span className="cb-admin-avatar">{(l.fullName||"?").slice(0,1).toUpperCase()}</span><span><b>{l.fullName}</b><small>{l.company||l.email}</small></span><em className={`cb-status status-${l.status}`}>{statusLabels[l.status]||l.status}</em></button>)}</div></section></div>
        <div className="cb-admin-card cb-admin-quick-actions"><div><h3>Quick actions</h3><p>Common tasks for the Clearbot team</p></div><div className="cb-admin-quick-grid">{canLeads&&<button onClick={()=>{setSection("leads");setManualOpen(true);}}><CirclePlus/>Add manual enquiry</button>}{canContent&&<button onClick={createBlog}><Pencil/>Create a blog</button>}{canContent&&<button onClick={()=>setSection("seo")}><Globe/>Update page SEO</button>}</div></div>
      </>}

      {section==="leads"&&canLeads&&<>
        <div className="cb-admin-toolbar"><div className="cb-admin-search"><Search size={16}/><input value={leadSearch} onChange={e=>setLeadSearch(e.target.value)} placeholder="Search name, email, company or country…"/></div><select className="cb-admin-select" value={leadStatus} onChange={e=>setLeadStatus(e.target.value)}><option value="all">All statuses</option>{statuses.map(s=><option key={s} value={s}>{statusLabels[s]}</option>)}</select><button className="cb-admin-secondary" onClick={exportCsv}><ArrowDownToLine size={15}/> Export CSV</button><button className="cb-admin-primary" onClick={()=>setManualOpen(true)}><Plus size={16}/> Add enquiry</button></div>
        <div className="cb-admin-table-card"><div className="cb-admin-table-head"><div><h3>All enquiries <span>{filteredLeads.length}</span></h3><p>Website submissions and manually added leads</p></div><button className="cb-admin-icon-button" onClick={refreshLeads}><RefreshCw size={16}/></button></div><div className="cb-admin-table-wrap"><table className="cb-admin-table"><thead><tr><th>CONTACT</th><th>COMPANY / COUNTRY</th><th>SOURCE</th><th>DATE</th><th>STATUS</th><th></th></tr></thead><tbody>{filteredLeads.map(l=><tr key={l.id} onClick={()=>openLead(l)} className={selectedLead?.id===l.id?"selected":""}><td><b>{l.fullName}</b><small>{l.email} · {l.phone}</small></td><td>{l.company||"—"}<small>{[l.region,l.country].filter(Boolean).join(", ")}</small></td><td><span className="cb-source-pill">{l.source||"website"}</span><small>{l.formType||""}</small></td><td>{dateText(l.createdAt)}</td><td onClick={e=>e.stopPropagation()}><select className={`cb-status-select status-${l.status}`} value={l.status} onChange={e=>saveLeadPatch(l.id,{status:e.target.value})}>{statuses.map(s=><option key={s} value={s}>{statusLabels[s]}</option>)}</select></td><td><button className="cb-admin-icon-button small" onClick={()=>openLead(l)}><ArrowUpRight size={15}/></button></td></tr>)}</tbody></table>{filteredLeads.length===0&&<div className="cb-admin-empty"><Users size={25}/><b>No enquiries found</b><span>New website and manual leads will appear here.</span></div>}</div></div>
        {selectedLead&&<div className="cb-admin-drawer-backdrop" onClick={()=>setSelectedLead(null)}><aside className="cb-admin-drawer" onClick={e=>e.stopPropagation()}><div className="cb-admin-drawer-head"><div><span className="cb-admin-kicker">ENQUIRY DETAILS</span><h2>{selectedLead.fullName}</h2><small>Ref: {selectedLead.id.slice(0,8).toUpperCase()}</small></div><button className="cb-admin-icon-button" onClick={()=>setSelectedLead(null)}><X/></button></div><div className="cb-admin-detail-grid"><Detail label="Email" value={selectedLead.email}/><Detail label="Phone" value={selectedLead.phone}/><Detail label="Company" value={selectedLead.company}/><Detail label="Location" value={[selectedLead.region,selectedLead.country].filter(Boolean).join(", ")}/><Detail label="Source" value={selectedLead.source||"website"}/><Detail label="Submitted" value={dateText(selectedLead.createdAt)}/></div><div className="cb-admin-detail-section"><b>Enquiry / requirement</b><p>{selectedLead.useCase||selectedLead.projectDetails||"No message supplied."}</p></div><div className="cb-admin-detail-section"><b>Comments / suggestions</b><p style={{whiteSpace:"pre-wrap"}}>{selectedLead.comments||"No additional comments or suggestions provided."}</p></div><label className="cb-admin-field"><span>Lead status</span><select value={selectedLead.status} onChange={e=>saveLeadPatch(selectedLead.id,{status:e.target.value})}>{statuses.map(s=><option key={s} value={s}>{statusLabels[s]}</option>)}</select></label><label className="cb-admin-field"><span>Follow-up date</span><input type="date" value={followUp?followUp.slice(0,10):""} onChange={e=>setFollowUp(e.target.value)}/></label><label className="cb-admin-field"><span>Assign to (email or name)</span><input defaultValue={selectedLead.assignedTo||""} id="cb-assignee" placeholder="Team member"/></label><button className="cb-admin-primary full" onClick={()=>saveLeadPatch(selectedLead.id,{followUpAt:followUp,assignedTo:(document.getElementById("cb-assignee") as HTMLInputElement)?.value||""})}><Save size={15}/> Save lead details</button><div className="cb-admin-detail-section"><b>Internal follow-up note</b><textarea rows={3} value={leadNote} onChange={e=>setLeadNote(e.target.value)} placeholder="Add a call summary or next action…"/><button className="cb-admin-secondary full" disabled={!leadNote.trim()} onClick={()=>saveLeadPatch(selectedLead.id,{note:leadNote,noteBy:user.name}).then(()=>setLeadNote("")).catch(()=>{})}><Plus size={15}/> Add note</button></div><div className="cb-admin-detail-section"><b>Activity notes</b>{(selectedLead.notes||[]).length===0?<p className="muted">No notes added yet.</p>:(selectedLead.notes||[]).map(n=><div className="cb-admin-note" key={n.id}><p>{n.text}</p><small>{n.by||"Team"} · {dateText(n.createdAt)}</small></div>)}</div><div className="cb-admin-notification-state"><Mail size={15}/> Email notification: <b>{selectedLead.emailNotification||"Not recorded"}</b></div></aside></div>}
        {manualOpen&&<Modal title="Add a manual enquiry" subtitle="Record a lead received by phone, email, WhatsApp or an event." onClose={()=>setManualOpen(false)}><form className="cb-admin-modal-form" onSubmit={addManualLead}><div className="cb-admin-form-grid"><Field label="Full name *"><input required value={manual.fullName} onChange={e=>setManual({...manual,fullName:e.target.value})}/></Field><Field label="Email *"><input type="email" required value={manual.email} onChange={e=>setManual({...manual,email:e.target.value})}/></Field><Field label="Phone *"><input required value={manual.phone} onChange={e=>setManual({...manual,phone:e.target.value})}/></Field><Field label="Company"><input value={manual.company} onChange={e=>setManual({...manual,company:e.target.value})}/></Field><Field label="Country"><input value={manual.country} onChange={e=>setManual({...manual,country:e.target.value})}/></Field><Field label="City / Region"><input value={manual.region} onChange={e=>setManual({...manual,region:e.target.value})}/></Field><Field label="Enquiry source"><select value={manual.source} onChange={e=>setManual({...manual,source:e.target.value})}><option value="manual">Manual</option><option value="phone">Phone</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="exhibition">Exhibition / event</option><option value="linkedin">LinkedIn</option><option value="referral">Referral</option></select></Field><Field label="Interest / requirement"><textarea rows={3} value={manual.useCase} onChange={e=>setManual({...manual,useCase:e.target.value})}/></Field></div><div className="cb-admin-modal-actions"><button type="button" className="cb-admin-secondary" onClick={()=>setManualOpen(false)}>Cancel</button><button disabled={busy} className="cb-admin-primary"><Send size={15}/> Save & notify Siddhant Sir</button></div></form></Modal>}
      </>}

      {section==="projects"&&canContent&&<>
        <div className="cb-admin-toolbar"><div><h2>Project library</h2><p>Create and publish project cards on the public Projects page. Existing case studies remain unchanged.</p></div><button className="cb-admin-primary" onClick={()=>{setProject(emptyProject());setEditingProject(true);}}>＋ Add project</button></div>
        {editingProject&&<form className="cb-admin-card" onSubmit={saveProject} style={{display:"grid",gap:14,marginBottom:20}}>
          <div className="cb-admin-card-heading"><div><h3>{project.id?"Edit project":"New project"}</h3><p>Fill the project details, then save as unpublished or publish it.</p></div><button type="button" className="cb-admin-icon-button" onClick={()=>setEditingProject(false)}><X/></button></div>
          <div className="cb-admin-form-grid">
            <label className="cb-admin-field"><span>Project title *</span><input required value={project.title} onChange={e=>setProject({...project,title:e.target.value,slug:project.id?project.slug:makeSlug(e.target.value)})}/></label>
            <label className="cb-admin-field"><span>URL slug</span><input value={project.slug} onChange={e=>setProject({...project,slug:makeSlug(e.target.value)})} placeholder="generated-from-title"/></label>
            <label className="cb-admin-field"><span>Location</span><input value={project.location} onChange={e=>setProject({...project,location:e.target.value})}/></label>
            <label className="cb-admin-field"><span>Category</span><input value={project.category} onChange={e=>setProject({...project,category:e.target.value})} placeholder="Waste recovery / Aquatic vegetation"/></label>
            <label className="cb-admin-field"><span>Image URL</span><input value={project.image} onChange={e=>setProject({...project,image:e.target.value})}/></label>
            <label className="cb-admin-field"><span>Video URL</span><input value={project.videoUrl} onChange={e=>setProject({...project,videoUrl:e.target.value})}/></label>
            <label className="cb-admin-field"><span>Detail page URL</span><input value={project.detailUrl} onChange={e=>setProject({...project,detailUrl:e.target.value})} placeholder="/project-example.html"/></label>
            <label className="cb-admin-field"><span>Publication status</span><select value={project.status} onChange={e=>setProject({...project,status:e.target.value})}><option value="draft">Unpublished</option><option value="published">Published</option></select></label>
          </div>
          <label className="cb-admin-field"><span>Project summary</span><textarea rows={4} value={project.summary} onChange={e=>setProject({...project,summary:e.target.value})}/></label>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className="cb-admin-primary" type="submit" disabled={busy}><Save size={15}/> Save project</button><button className="cb-admin-secondary" type="button" onClick={()=>setEditingProject(false)}>Cancel</button></div>
        </form>}
        <div className="cb-admin-table-card"><div className="cb-admin-table-head"><div><h3>All managed projects <span>{projects.length}</span></h3><p>Published projects appear in the public listing. Drafts remain private.</p></div><button className="cb-admin-icon-button" onClick={()=>api<{projects:Project[]}>("/api/admin/projects").then(r=>setProjects(r.projects)).catch(e=>setError((e as Error).message))}><RefreshCw size={16}/></button></div>
          <div className="cb-admin-table-wrap"><table className="cb-admin-table"><thead><tr><th>PROJECT</th><th>LOCATION</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{projects.map(item=><tr key={item.id}><td><b>{item.title}</b><small>{item.slug}</small></td><td>{item.location||"—"}</td><td><span className={`cb-blog-status ${item.status}`}>{item.status==="published"?"Published":"Unpublished"}</span></td><td><button className="cb-admin-text-link" onClick={()=>{setProject(item);setEditingProject(true);}}>Edit</button> <button className="cb-admin-text-link" onClick={()=>toggleProject(item)}>{item.status==="published"?"Unpublish":"Publish"}</button> <button className="cb-admin-text-link" onClick={()=>deleteProject(item)}>Delete</button></td></tr>)}</tbody></table>{projects.length===0&&<div className="cb-admin-empty"><FileText/><b>No Admin projects yet</b><span>Add a project to show it on the public Projects page.</span></div>}</div>
        </div>
      </>}
      {section==="blogs"&&canContent&&<>
        {!editingBlog?<><div className="cb-admin-toolbar"><div className="cb-admin-toolbar-copy"><b>Content library</b><small>Write, edit and publish Clearbot insights.</small></div><button className="cb-admin-primary" onClick={createBlog}><Plus size={16}/> Create blog</button></div><div className="cb-admin-table-card"><div className="cb-admin-table-head"><div><h3>All blog posts <span>{blogs.length}</span></h3><p>Published articles and saved drafts</p></div></div><div className="cb-admin-blog-list">{blogs.map(b=><div className="cb-admin-blog-row" key={b.id}>{b.featuredImage?<img src={b.featuredImage} alt=""/>:<div className="cb-admin-blog-placeholder"><FileText/></div>}<div className="cb-admin-blog-copy"><b>{b.title}</b><small>/blog/{b.slug} · {b.category||"Uncategorised"}</small></div><span className={`cb-blog-status ${b.status}`}>{b.status}</span><span className="muted">{dateText(b.updatedAt)}</span><button className="cb-admin-icon-button" onClick={()=>editBlog(b)}><Pencil size={15}/></button><button className="cb-admin-icon-button danger" onClick={()=>deleteBlog(b)}><Trash2 size={15}/></button></div>)}{blogs.length===0&&<div className="cb-admin-empty"><BookOpen/><b>No blogs yet</b><span>Create your first article from the button above.</span></div>}</div></div></>:<div className="cb-admin-editor-layout"><div className="cb-admin-card cb-admin-editor-main"><div className="cb-admin-card-heading"><div><span className="cb-admin-kicker">CONTENT EDITOR</span><h3>{blog.id?"Edit blog article":"Create new blog article"}</h3></div><button className="cb-admin-icon-button" onClick={()=>setEditingBlog(false)}><X/></button></div><label className="cb-admin-field"><span>Blog title *</span><input value={blog.title} onChange={e=>setBlog({...blog,title:e.target.value,slug:blog.id?blog.slug:makeSlug(e.target.value)})} placeholder="Enter a compelling article title"/></label><label className="cb-admin-field"><span>URL slug</span><div className="cb-admin-slug"><span>/blog/</span><input value={blog.slug} onChange={e=>setBlog({...blog,slug:makeSlug(e.target.value)})}/></div></label><label className="cb-admin-field"><span>Short description</span><textarea rows={2} value={blog.excerpt} onChange={e=>setBlog({...blog,excerpt:e.target.value})} placeholder="Summarise the article for the blog listing page."/></label><div className="cb-admin-editor-toolbar"><button type="button" onClick={()=>document.execCommand("bold")}><b>B</b></button><button type="button" onClick={()=>document.execCommand("italic")}><i>I</i></button><button type="button" onClick={()=>document.execCommand("formatBlock",false,"h2")}>H2</button><button type="button" onClick={()=>document.execCommand("formatBlock",false,"h3")}>H3</button><button type="button" onClick={()=>document.execCommand("insertUnorderedList")}><span>• List</span></button><button type="button" onClick={()=>{const href=prompt("Enter link URL");if(href)document.execCommand("createLink",false,href);}}>Link</button><label className="cb-editor-image-button"><ImagePlus size={14}/> Insert image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Image read failed"));reader.readAsDataURL(f);});try{const r=await api<{url:string}>("/api/admin/uploads",{method:"POST",body:JSON.stringify({filename:f.name,dataUrl})});editorRef.current?.focus();document.execCommand("insertImage",false,r.url);}catch(err){setError((err as Error).message);}}}/></label></div><div ref={editorRef} className="cb-admin-rich-editor" contentEditable suppressContentEditableWarning onInput={e=>setBlog(prev=>({...prev,content:e.currentTarget.innerHTML}))} data-placeholder="Start writing your Clearbot article…"/><div className="cb-admin-editor-help">Use the toolbar to format headings, lists, links and images. Content is sanitised before publishing.</div></div><div className="cb-admin-editor-side"><section className="cb-admin-card"><h3>Publishing</h3><label className="cb-admin-field"><span>Status</span><select value={blog.status} onChange={e=>setBlog({...blog,status:e.target.value})}><option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled</option></select></label><label className="cb-admin-field"><span>Publish date / time</span><input type="datetime-local" value={blog.publishAt?new Date(blog.publishAt).toISOString().slice(0,16):""} onChange={e=>setBlog({...blog,publishAt:e.target.value?new Date(e.target.value).toISOString():""})}/></label><label className="cb-admin-field"><span>Author</span><input value={blog.author} onChange={e=>setBlog({...blog,author:e.target.value})} placeholder={user.name}/></label><button className="cb-admin-primary full" disabled={busy} onClick={()=>saveBlog("published")}><Check size={15}/> Publish article</button><button className="cb-admin-secondary full" disabled={busy} onClick={()=>saveBlog("draft")}><Save size={15}/> Save draft</button></section><section className="cb-admin-card"><h3>Featured image</h3>{blog.featuredImage&&<img className="cb-blog-feature-preview" src={blog.featuredImage} alt={blog.imageAlt}/>}<label className="cb-admin-upload"><ImagePlus size={18}/><span>Upload image</span><small>JPG, PNG, WEBP or GIF · Max 5 MB</small><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>uploadImage(e.target.files?.[0])}/></label><label className="cb-admin-field"><span>Image URL</span><input value={blog.featuredImage} onChange={e=>setBlog({...blog,featuredImage:e.target.value})}/></label><label className="cb-admin-field"><span>Image alt text</span><input value={blog.imageAlt} onChange={e=>setBlog({...blog,imageAlt:e.target.value})}/></label></section><section className="cb-admin-card"><h3>Category & tags</h3><label className="cb-admin-field"><span>Category</span><select value={blog.category} onChange={e=>setBlog({...blog,category:e.target.value})}><option value="">Select category</option>{categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label><form className="cb-admin-add-category" onSubmit={addCategory}><input value={categoryName} onChange={e=>setCategoryName(e.target.value)} placeholder="New category"/><button type="submit"><Plus size={15}/></button></form><label className="cb-admin-field"><span>Tags (comma separated)</span><input value={blog.tags.join(", ")} onChange={e=>setBlog({...blog,tags:e.target.value.split(",").map(v=>v.trim()).filter(Boolean)})}/></label></section><section className="cb-admin-card"><h3>Blog SEO</h3><label className="cb-admin-field"><span>SEO title</span><input value={blog.seo?.title||""} onChange={e=>setBlog({...blog,seo:{...blog.seo,title:e.target.value}})}/></label><label className="cb-admin-field"><span>Meta description</span><textarea rows={3} value={blog.seo?.description||""} onChange={e=>setBlog({...blog,seo:{...blog.seo,description:e.target.value}})}/></label><label className="cb-admin-field"><span>Focus keywords</span><input value={blog.seo?.keywords||""} onChange={e=>setBlog({...blog,seo:{...blog.seo,keywords:e.target.value}})}/></label></section><button className="cb-admin-secondary full" onClick={()=>setEditingBlog(false)}>Cancel editing</button></div></div>}</>
      }

      {section==="images"&&canContent&&<>
        <div className="cb-admin-toolbar cb-site-image-toolbar">
          <div className="cb-admin-toolbar-copy"><b>Website image library <span>{siteImages.length} image slots · {groupedSiteImages.length} pages</span></b><small>Homepage slider images are grouped separately. Each card shows the actual uploaded dimensions against the recommended size for that image slot.</small><small className="cb-site-image-overall-loaded">Preview status: {Object.keys(imageDimensions).length} of {siteImages.length} images loaded</small></div>
          <div className="cb-site-image-toolbar-actions"><label className="cb-site-image-search"><Search size={15}/><input value={siteImageSearch} onChange={e=>setSiteImageSearch(e.target.value)} placeholder="Search page, image or filename…"/></label><button className="cb-admin-secondary" onClick={refresh}><RefreshCw size={15}/> Refresh</button></div>
        </div>
        {groupedSiteImages.length===0?<div className="cb-admin-empty cb-site-image-empty"><Images/><b>No matching images</b><span>Change the search term to see more website images.</span></div>:groupedSiteImages.map(([page,slots],pageIndex)=>{
          const loadedCount=slots.filter(slot=>Boolean(imageDimensions[slot.id])).length;
          const pagePath=(page==="index.html"||page==="Homepage Hero Slider")?"/":`/${page}`;
          return <section className="cb-site-image-page" key={page}>
            <header className="cb-site-image-page-heading"><div className="cb-site-image-page-title"><span>PAGE {String(pageIndex+1).padStart(2,"0")}</span><h2>{imagePageTitle(page)}</h2><a href={pagePath} target="_blank" rel="noreferrer">{pagePath} <ArrowUpRight size={12}/></a></div><div className="cb-site-image-page-stats"><b>{slots.length}</b><span>Image slots</span><i>{loadedCount}/{slots.length} loaded</i></div></header>
            {page==="Homepage Hero Slider"&&<div className="cb-site-image-group-note">These five images are used by the homepage hero slider. Replace each slide here to change that specific carousel image. Recommended source size: 1920 × 900 px (wide landscape).</div>}
            <div className="cb-site-image-grid">{slots.map((slot,slotIndex)=>{
              const source=imageSource(slot);
              const fileName=slot.url?"Admin uploaded replacement":(slot.src.startsWith("data:")?"Embedded image":(slot.src.split("?")[0].split("/").pop()||"Website image"));
              const slide=heroSlideNumber(slot);
              const requirement=imageRequirement(slot);
              const actual=imageDimensions[slot.id]||"Loading…";
              const resolutionStatus=imageResolutionStatus(slot,imageDimensions[slot.id]||"");
              const cardTitle=slide?`Homepage Hero Slider — Slide ${slide}: ${homeHeroSlideNames[slide-1]}`:(slot.alt||fileName);
              const positionLabel=slide?`Slide ${slide} of 5 · Homepage carousel image`:`${imagePageTitle(page)} · Image ${slotIndex+1} of ${slots.length}`;
              return <article className={`cb-admin-card cb-site-image-card${slide?" cb-site-image-hero-card":""}`} key={slot.id}>
                {slot.id.startsWith("products.html::")&&slot.videoUrl&&<video className="cb-site-image-video-preview" src={slot.videoUrl} controls playsInline preload="metadata"/>}<div className="cb-site-image-preview">{source?<img src={source} alt={slot.alt||fileName} loading="lazy" onLoad={e=>{void recordSiteImageMeta(slot,e.currentTarget);}} onError={e=>{const img=e.currentTarget;img.style.display="none";const parent=img.parentElement;if(parent){parent.classList.add("is-broken");if(!parent.querySelector(".cb-site-image-dummy")){const fallback=document.createElement("div");fallback.className="cb-site-image-dummy";fallback.innerHTML="<b>Preview unavailable</b><small>Upload a replacement image</small>";parent.appendChild(fallback);}}}}/>:<div className="cb-site-image-dummy"><ImagePlus/><b>Image placeholder</b><small>Upload image to fill this slot</small></div>}</div>
                <div className="cb-site-image-info"><b>{cardTitle}</b><small className="cb-site-image-position">{positionLabel}</small><div className="cb-site-image-meta cb-site-image-meta-detailed"><span><strong>Current uploaded</strong>{actual}</span><span><strong>Recommended</strong>{requirement.size}<small>{requirement.detail}</small></span><span><strong>File size</strong>{imageFileSizes[slot.id]||"Checking…"}</span><span><strong>Format</strong>{imageFormat(source)}</span></div><small className={`cb-site-image-resolution ${resolutionStatus==="Meets recommendation"?"good":resolutionStatus==="Below recommendation"?"warn":""}`}>{resolutionStatus}</small><small className="cb-site-image-source" title={slot.src}>{fileName}</small></div>
                <div className="cb-site-image-actions"><label className="cb-admin-primary compact"><ImagePlus size={14}/> Upload replacement<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e=>uploadSiteImage(slot,e.target.files?.[0])}/></label>{slot.url&&<button className="cb-admin-secondary compact" disabled={busy} onClick={()=>resetSiteImage(slot)}>Restore original</button>}{slot.id.startsWith("products.html::")&&<><label className="cb-admin-primary compact">Upload / Replace Video<input type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={e=>uploadSiteVideo(slot,e.target.files?.[0])}/></label>{slot.videoUrl&&<button className="cb-admin-secondary compact" disabled={busy} onClick={()=>resetSiteVideo(slot)}>Remove Video</button>}</>}</div>
              </article>;
            })}</div>
          </section>;
        })}
      </>}

      {section==="seo"&&canContent&&<div className="cb-admin-seo-layout"><section className="cb-admin-card"><div className="cb-admin-card-heading"><div><h3>Page SEO settings</h3><p>Choose a page and manage its search and social metadata.</p></div><Globe/></div><form onSubmit={saveSeo} className="cb-admin-form-stack"><label className="cb-admin-field"><span>Website page</span><select value={seoPath} onChange={e=>setSeoPath(e.target.value)}>{pageOptions.map(p=><option key={p} value={p}>{p==="/"?"Homepage":p}</option>)}</select></label><label className="cb-admin-field"><span>SEO title <small>{seoForm.title.length}/60</small></span><input maxLength={220} value={seoForm.title} onChange={e=>setSeoForm({...seoForm,title:e.target.value})} placeholder="Page title for Google"/></label><label className="cb-admin-field"><span>Meta description <small>{seoForm.description.length}/160</small></span><textarea rows={3} maxLength={500} value={seoForm.description} onChange={e=>setSeoForm({...seoForm,description:e.target.value})} placeholder="Describe this page for search results."/></label><label className="cb-admin-field"><span>Focus & secondary keywords</span><input value={seoForm.keywords} onChange={e=>setSeoForm({...seoForm,keywords:e.target.value})} placeholder="waterway cleanup, aquatic weed harvester"/></label><label className="cb-admin-field"><span>Canonical URL</span><input value={seoForm.canonical} onChange={e=>setSeoForm({...seoForm,canonical:e.target.value})} placeholder="https://www.clearbot.org/page"/></label><label className="cb-admin-field"><span>Search indexing</span><select value={seoForm.robots} onChange={e=>setSeoForm({...seoForm,robots:e.target.value})}><option value="index,follow">Index and follow</option><option value="noindex,follow">No index, follow links</option><option value="noindex,nofollow">No index, no follow</option></select></label><div className="cb-admin-section-divider">SOCIAL SHARING / OPEN GRAPH</div><label className="cb-admin-field"><span>Social title</span><input value={seoForm.ogTitle} onChange={e=>setSeoForm({...seoForm,ogTitle:e.target.value})}/></label><label className="cb-admin-field"><span>Social description</span><textarea rows={2} value={seoForm.ogDescription} onChange={e=>setSeoForm({...seoForm,ogDescription:e.target.value})}/></label><label className="cb-admin-field"><span>Social image URL</span><input value={seoForm.ogImage} onChange={e=>setSeoForm({...seoForm,ogImage:e.target.value})}/></label><button className="cb-admin-primary" disabled={busy}><Save size={15}/> Save SEO settings</button></form></section><section className="cb-admin-card cb-admin-seo-preview"><span className="cb-admin-kicker">SEARCH PREVIEW</span><div className="cb-seo-google"><small>clearbot.org › {seoPath.replace(/^\//,"")}</small><h3>{seoForm.title||"Clearbot | Cleaner Waterways"}</h3><p>{seoForm.description||"Your page description will appear here in search results."}</p></div><div className="cb-admin-seo-checks"><h3>SEO checklist</h3><CheckRow ok={seoForm.title.length>=30&&seoForm.title.length<=60} label="Title is between 30–60 characters"/><CheckRow ok={seoForm.description.length>=70&&seoForm.description.length<=160} label="Description is between 70–160 characters"/><CheckRow ok={Boolean(seoForm.keywords.trim())} label="Focus keywords added"/><CheckRow ok={Boolean(seoForm.canonical.trim())} label="Canonical URL configured"/><CheckRow ok={Boolean(seoForm.ogImage.trim())} label="Social sharing image configured"/></div><div className="cb-admin-seo-note"><AlertCircle size={16}/> SEO checks are guidance, not a ranking guarantee. Search engines may choose different snippets.</div></section></div>}

      {section==="users"&&isSuper&&<><div className="cb-admin-toolbar"><div className="cb-admin-toolbar-copy"><b>Team access</b><small>Manage Super Admin, Sales and Marketing accounts.</small></div><button className="cb-admin-primary" onClick={()=>setNewUserOpen(true)}><Plus size={16}/> Add team user</button></div><div className="cb-admin-table-card"><div className="cb-admin-table-head"><div><h3>Admin users <span>{users.length}</span></h3><p>Only active users can sign in.</p></div></div><div className="cb-admin-user-list">{users.map(u=><div className="cb-admin-user-row" key={u.id}><span className="cb-admin-avatar">{u.name.slice(0,1)}</span><div><b>{u.name}</b><small>{u.email}</small></div><span className="cb-role-pill">{u.role.replace("_"," ")}</span><span className={u.active?"cb-user-active":"cb-user-disabled"}>{u.active?"Active":"Disabled"}</span><button className="cb-admin-secondary compact" disabled={u.id===user.id} onClick={()=>toggleUser(u)}>{u.active?"Disable":"Enable"}</button></div>)}</div></div>{newUserOpen&&<Modal title="Create team account" subtitle="Give the team member the correct access level." onClose={()=>setNewUserOpen(false)}><form className="cb-admin-modal-form" onSubmit={addUser}><div className="cb-admin-form-grid"><Field label="Full name"><input required value={newUser.name} onChange={e=>setNewUser({...newUser,name:e.target.value})}/></Field><Field label="Email"><input type="email" required value={newUser.email} onChange={e=>setNewUser({...newUser,email:e.target.value})}/></Field><Field label="Temporary password (12+ characters)"><input type="password" minLength={12} required value={newUser.password} onChange={e=>setNewUser({...newUser,password:e.target.value})}/></Field><Field label="Role"><select value={newUser.role} onChange={e=>setNewUser({...newUser,role:e.target.value})}><option value="sales">Sales</option><option value="marketing">Marketing</option><option value="super_admin">Super Admin</option></select></Field></div><div className="cb-admin-modal-actions"><button className="cb-admin-secondary" type="button" onClick={()=>setNewUserOpen(false)}>Cancel</button><button className="cb-admin-primary" disabled={busy}><Plus size={15}/> Create account</button></div></form></Modal>}</>}

      {section==="settings"&&<div className="cb-admin-settings-grid"><section className="cb-admin-card"><span className="cb-admin-kicker">EMAIL NOTIFICATIONS</span><h3>New enquiry alerts</h3><p>Every website and manually added enquiry is configured to notify the recipient below.</p><div className="cb-admin-setting-line"><Mail/><div><b>sid@clearbot.org</b><small>Enquiry notification recipient</small></div><span className="cb-setting-value">Configured</span></div><div className={`cb-admin-config-status ${settings?.emailConfigured?"good":"warn"}`}>{settings?.emailConfigured?<CheckCircle2/>:<AlertCircle/>}{settings?.emailConfigured?"SMTP credentials detected":"SMTP credentials required to send actual email"}</div><p className="cb-admin-help">Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in the Render Environment settings. The recipient can be changed with ENQUIRY_NOTIFY_TO.</p></section><section className="cb-admin-card"><span className="cb-admin-kicker">DATA STORAGE</span><h3>Lead and content database</h3><p>Admin records are stored in the configured data store.</p><div className="cb-admin-setting-line"><Activity/><div><b>{settings?.database||"Checking…"}</b><small>Current storage provider</small></div><span className={`cb-setting-value ${settings?.database==="PostgreSQL"?"good":"warn"}`}>{settings?.database==="PostgreSQL"?"Persistent":"Development"}</span></div><p className="cb-admin-help">For the hosted demo and production, configure a Render PostgreSQL database using DATABASE_URL. Local JSON storage is only a development fallback and may be lost on ephemeral hosting.</p></section><section className="cb-admin-card"><span className="cb-admin-kicker">ACCESS CONTROL</span><h3>Team roles</h3><div className="cb-role-explainer"><b>Super Admin</b><span>Full access to leads, blogs, SEO, users and settings.</span><b>Sales</b><span>Lead inbox, manual entry, assignments, follow-ups and exports.</span><b>Marketing</b><span>Blog editor, categories, image uploads and SEO management.</span></div></section></div>}
    </main>
  </div>;
}

function Stat({icon,label,value,hint}:{icon:ReactNode;label:string;value:any;hint:string}){return <div className="cb-admin-stat"><span className="cb-admin-stat-icon">{icon}</span><small>{label}</small><strong>{value}</strong><em>{hint}</em></div>}
function Detail({label,value}:{label:string;value?:string}){return <div><small>{label}</small><b>{value||"—"}</b></div>}
function Field({label,children}:{label:string;children:ReactNode}){return <label className="cb-admin-field"><span>{label}</span>{children}</label>}
function Modal({title,subtitle,onClose,children}:{title:string;subtitle:string;onClose:()=>void;children:ReactNode}){return <div className="cb-admin-modal-backdrop" onClick={onClose}><section className="cb-admin-modal" onClick={e=>e.stopPropagation()}><div className="cb-admin-modal-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="cb-admin-icon-button" onClick={onClose}><X/></button></div>{children}</section></div>}
function CheckRow({ok,label}:{ok:boolean;label:string}){return <div className="cb-seo-check"><span className={ok?"ok":"todo"}>{ok?<Check size={13}/>:<Clock3 size={13}/>}</span>{label}</div>}
