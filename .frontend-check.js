

const authScreen = document.getElementById("authScreen");
const authForm = document.getElementById("authForm");

const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authTitle = document.getElementById("authTitle");
const authDescription = document.getElementById("authDescription");
const authSubmit = document.getElementById("authSubmit");

const authReset = document.getElementById("authReset");
const authMessage = document.getElementById("authMessage");

let supabaseClient = null;


async function apiFetch(url, options = {}) {
  if (!supabaseClient) throw new Error("Please sign in first.");

  const { data, error } = await supabaseClient.auth.getSession();
  const session = data && data.session;

  if (error || !session || !session.user.email_confirmed_at) {
    throw new Error("Your verified session has expired. Please sign in again.");
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", "Bearer " + session.access_token);

  return window.fetch(url, { ...options, headers });
}

async function downloadAnalysisPdf(id, filename = "analysis-report.pdf") {
  const response = await apiFetch(
    "/api/analyses/" + encodeURIComponent(id) + "/pdf"
  );

  if (!response.ok) throw new Error("Unable to download PDF report.");

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showWorkspace(session) {
  if (!session || !session.user || !session.user.email_confirmed_at) {
    hideWorkspace();
    showAuthMessage("Please verify your email before accessing the workspace.");
    return;
  }

  document.getElementById("authScreen").style.display = "none";
  document.getElementById("mainWorkspace").style.display = "";

  loadAIModels();
  loadChatHistory();
  loadAnalysisHistory();
}

function hideWorkspace() {
  document.getElementById("mainWorkspace").style.display = "none";
  document.getElementById("authScreen").style.display = "flex";
}

function showAuthMessage(message) {
  authMessage.textContent = message;
}

authReset.addEventListener("click", async () => {
  if (!supabaseClient) return showAuthMessage("Authentication is not connected.");
  const email = authEmail.value.trim();
  if (!email) return showAuthMessage("Enter your email address first.");

  authReset.disabled = true;
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });
  authReset.disabled = false;
  showAuthMessage(error ? error.message : "If the account exists, a password reset email has been sent.");
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabaseClient) {
    return showAuthMessage("Supabase is not connected. Refresh and try again.");
  }

  const email = authEmail.value.trim();
  const password = authPassword.value;
  authSubmit.disabled = true;
  showAuthMessage("Please wait...");

  try {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      showAuthMessage("Sign-in successful. Opening your private workspace...");
  } catch (error) {
    showAuthMessage(error.message || "Authentication failed. Please try again.");
  } finally {
    authSubmit.disabled = false;
  }
});

async function initialiseSupabaseAuth() {
  try {
    if (!window.supabase) throw new Error("Supabase browser library did not load.");

    const response = await window.fetch("/api/config");
    if (!response.ok) throw new Error("Could not load Supabase configuration.");

    const config = await response.json();
    if (!config.supabaseUrl || !config.supabasePublishableKey) {
      throw new Error("Supabase configuration is missing.");
    }

    supabaseClient = window.supabase.createClient(
      config.supabaseUrl,
      config.supabasePublishableKey
    );

    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        hideWorkspace();
        showAuthMessage("You have signed out.");
      } else if (session && event === "SIGNED_IN") {
        if (session.user.email_confirmed_at) {
          showWorkspace(session);
          showAuthMessage("Signed in successfully.");
        } else {
          hideWorkspace();
          showAuthMessage("Please verify your email before accessing the workspace.");
        }
      }
    });

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (data.session && data.session.user.email_confirmed_at) {
      showWorkspace(data.session);
      showAuthMessage("Welcome back.");
    } else {
      hideWorkspace();
      showAuthMessage(
        data.session
          ? "Please verify your email before accessing the workspace."
          : "Supabase connected. Sign in or create an account."
      );
    }
  } catch (error) {
    hideWorkspace();
    showAuthMessage(error.message || "Unable to connect to Supabase.");
  }
}
updateAuthForm();
initialiseSupabaseAuth();

document.getElementById("signOutButton").addEventListener("click", async () => {
  if (!supabaseClient) return;
  const button = document.getElementById("signOutButton");
  button.disabled = true;
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    hideWorkspace();
    showAuthMessage("You have signed out.");
  } catch (error) {
    alert("Sign-out failed: " + error.message);
  } finally {
    button.disabled = false;
  }
});


const question=document.getElementById("question");
const originalSendButton=document.getElementById("send");
originalSendButton.addEventListener("click",async()=>{
 if(!pendingImages.length)return;
 const files=[...pendingImages];
 clearImagePreview();
 await analyseUploadedImages(files);
});
const messages=document.getElementById("messages");
const chatHistory=document.getElementById("chatHistory");
let currentChatId=null;
const welcome=document.getElementById("welcome");
const suggestions=document.getElementById("suggestions");
const send=document.getElementById("send");
const aiMode=document.getElementById("aiMode");
const aiModel=document.getElementById("aiModel");

async function loadAIModels(){
 try{
  const response=await apiFetch("/api/models");
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||"Model list unavailable.");

  aiModel.textContent="";
  (data.models||[]).forEach(model=>{
   const option=document.createElement("option");
   option.value=model;
   option.textContent=model;
   aiModel.appendChild(option);
  });

  if(data.current && (data.models||[]).includes(data.current)){
   aiModel.value=data.current;
  }
  if(!data.models||!data.models.length){
   aiModel.add(new Option("No models available",""));
  }
 }catch(error){
  aiModel.textContent="";
  aiModel.add(new Option("Models unavailable",""));
  console.error("AI model loading failed:",error);
 }
}


const mic=document.getElementById("mic");
const speakToggle=document.getElementById("speakToggle");
const uploadToggle=document.getElementById("uploadToggle");
const uploadMenu=document.getElementById("uploadMenu");
const fileInput=document.getElementById("fileInput");
const chooseDocument=document.getElementById("chooseDocument");

uploadToggle.onclick=()=>{
 uploadMenu.classList.toggle("open");
};
chooseDocument.onclick=()=>{
 uploadMenu.classList.remove("open");
 fileInput.click();
};

const imageInput=document.getElementById("imageInput");
const chooseImage=document.getElementById("chooseImage");

chooseImage.onclick=()=>{
 uploadMenu.classList.remove("open");
 imageInput.click();
};

let pendingImages = [];
let previewUrls = [];

const imagePreview=document.getElementById("imagePreview");
const previewItems=document.getElementById("previewItems");

function clearImagePreview(){
 previewUrls.forEach(url=>URL.revokeObjectURL(url));
 previewUrls=[];
 pendingImages=[];
 previewItems.innerHTML="";
 imagePreview.style.display="none";
 imageInput.value="";
}

function renderImagePreviews(){
 previewItems.innerHTML="";
 imagePreview.style.display=pendingImages.length?"flex":"none";

 pendingImages.forEach((file,index)=>{
  const url=URL.createObjectURL(file);
  previewUrls.push(url);

  const card=document.createElement("div");
  card.style.cssText="display:flex;align-items:center;gap:7px;padding:6px;background:#303030;border:1px solid #484848;border-radius:9px;max-width:100%";

  const img=document.createElement("img");
  img.src=url;
  img.alt="Selected image";
  img.style.cssText="width:48px;height:48px;object-fit:cover;border-radius:7px";

  const name=document.createElement("span");
  name.textContent=file.name;
  name.style.cssText="font-size:11px;color:#ddd;max-width:100px;overflow-wrap:anywhere";

  const remove=document.createElement("button");
  remove.type="button";
  remove.textContent="×";
  remove.title="Remove image";
  remove.style.cssText="background:#414141;color:white;border:0;border-radius:7px;padding:5px 9px";
  remove.onclick=()=>{
   pendingImages.splice(index,1);
   previewUrls.forEach(url=>URL.revokeObjectURL(url));
   previewUrls=[];
   renderImagePreviews();
  };

  card.append(img,name,remove);
  previewItems.appendChild(card);
 });
}

async function analyseUploadedImages(files){
 if(!files.length)return;

 const prompt=question.value.trim() ||
  "Describe these images, identify important details, and compare them where useful.";

 const formData=new FormData();
 files.forEach(file=>formData.append("files",file));
 formData.append("prompt",prompt);

 welcome.style.display="none";
 suggestions.style.display="none";

 addMessage("Analyse "+files.length+" image(s): "+files.map(f=>f.name).join(", "),"user");

 const loading=addMessage("DCO CYBER AI is examining "+files.length+" image(s)...","assistant");

 try{
  const response=await apiFetch("/api/image-analysis",{method:"POST",body:formData});
  const data=await response.json();

  if(!response.ok)throw new Error(data.error||"Image analysis failed.");

  const result=data.analysis||"No analysis returned.";
  loading.firstChild.textContent=result;

  const pdfLink=document.createElement("button");
  pdfLink.type="button";
  pdfLink.textContent="Download PDF report";
  pdfLink.className="history-delete";
  pdfLink.style.display="inline-block";
  pdfLink.style.marginTop="8px";
  pdfLink.onclick=()=>downloadAnalysisPdf(data.id).catch(error=>alert(error.message));
  loading.appendChild(pdfLink);

  await loadAnalysisHistory();
  if(voiceEnabled)speak(result);
 }catch(error){
  loading.firstChild.textContent="Unable to analyse images: "+error.message;
 }finally{
  question.value="";
 }
}

async function analyseUploadedFiles(files){
 if(!files || !files.length)return;

 const selected=Array.from(files).slice(0,4);
 const prompt=question.value.trim() || "Analyse and compare these documents. Identify key findings, similarities, differences, and limitations.";

 const formData=new FormData();
 selected.forEach(file=>formData.append("files",file));
 formData.append("prompt",prompt);

 welcome.style.display="none";
 suggestions.style.display="none";

 addMessage("Analyse documents: "+selected.map(file=>file.name).join(", "),"user");

 const loading=addMessage("DCO CYBER AI is analysing your documents together...","assistant");

 try{
  const response=await apiFetch("/api/file-analysis",{method:"POST",body:formData});
  const data=await response.json();

  if(!response.ok)throw new Error(data.error||"Upload failed.");

  const result=data.analysis||"No analysis returned.";
  loading.firstChild.textContent=result;

  if(data.id){
   const pdfLink=document.createElement("button");
  pdfLink.type="button";
  pdfLink.textContent="Download PDF report";
  pdfLink.className="history-delete";
  pdfLink.style.display="inline-block";
  pdfLink.style.marginTop="8px";
  pdfLink.onclick=()=>downloadAnalysisPdf(data.id).catch(error=>alert(error.message));
  loading.appendChild(pdfLink);
   await loadAnalysisHistory();
  }

  if(voiceEnabled)speak(result);
 }catch(error){
  loading.firstChild.textContent="Unable to analyse documents: "+error.message;
 }finally{
  question.value="";
 }
}

fileInput.onchange=async()=>{
 const files=Array.from(fileInput.files||[]);
 if(files.length>4){
  alert("Choose no more than 4 documents at a time.");
 }else if(files.length){
  await analyseUploadedFiles(files);
 }
 fileInput.value="";
};

imageInput.onchange=()=>{
 const selected=Array.from(imageInput.files||[]);
 if(!selected.length)return;

 const valid=selected.filter(file=>
  ["image/png","image/jpeg","image/webp"].includes(file.type)
 );

 if(valid.length!==selected.length){
  alert("Only PNG, JPG, JPEG and WebP images are supported.");
 }

 const remaining=4-pendingImages.length;
 if(valid.length>remaining){
  alert("You can attach a maximum of 4 images.");
 }

 pendingImages.push(...valid.slice(0,Math.max(0,remaining)));
 renderImagePreviews();
 imageInput.value="";
};

let voiceEnabled=true;
let recognition=null;

function toggleMenu(){
 document.getElementById("sidebar").classList.toggle("open");
 document.getElementById("backdrop").classList.toggle("show");
}

function newChat(){
 currentChatId=null;
 messages.innerHTML="";
 welcome.style.display="";
 suggestions.style.display="";
 question.value="";
 if(window.speechSynthesis) speechSynthesis.cancel();
 loadChatHistory();
 if(window.innerWidth<=700){
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("backdrop").classList.remove("show");
 }
 question.focus();
}

const historySearch=document.getElementById("historySearch");
let savedChats=[];

historySearch.addEventListener("input",()=>{
 renderChatHistory(historySearch.value);
});

function renderChatHistory(query=""){
 chatHistory.innerHTML="";
 const filtered=savedChats.filter(chat=>
  chat.title.toLowerCase().includes(query.trim().toLowerCase())
 );

 if(!filtered.length){
  chatHistory.textContent=query.trim()
   ?"No matching conversations."
   :"No saved conversations yet.";
  return;
 }

 filtered.forEach(chat=>{
  const item=document.createElement("div");
  item.className="history-item"+(chat.id===currentChatId?" active":"");

  const open=document.createElement("button");
  open.className="history-open";
  open.textContent=chat.title;
  open.onclick=()=>openChat(chat.id);

  const rename=document.createElement("button");
  rename.className="history-delete";
  rename.textContent="✎";
  rename.title="Rename conversation";
  rename.onclick=()=>renameChat(chat.id,chat.title);

  const del=document.createElement("button");
  del.className="history-delete";
  del.textContent="×";
  del.title="Delete conversation";
  del.onclick=()=>deleteChat(chat.id);

  const exportBtn=document.createElement("button");
  exportBtn.className="history-delete";
  exportBtn.textContent="↓";
  exportBtn.title="Export conversation";
  exportBtn.onclick=()=>exportChat(chat.id);

  item.append(open,rename,exportBtn,del);
  chatHistory.appendChild(item);
 });
}

document.getElementById("clearHistory").onclick=async()=>{
 if(!confirm("Permanently delete ALL saved conversations?"))return;
 try{
  const response=await apiFetch("/api/chats",{method:"DELETE"});
  if(!response.ok)throw new Error("Unable to clear history.");
  currentChatId=null;
  messages.innerHTML="";
  welcome.style.display="";
  suggestions.style.display="";
  savedChats=[];
  historySearch.value="";
  renderChatHistory();
 }catch(error){
  alert(error.message);
 }
};

async function loadChatHistory(){
 try{
  const response=await apiFetch("/api/chats");
  if(!response.ok)throw new Error("History unavailable");
  savedChats=await response.json();
  renderChatHistory(historySearch.value);
 }catch(error){
  chatHistory.textContent="Unable to load chat history.";
 }
}

async function exportChat(id){
 try{
  const response=await apiFetch("/api/chats/"+encodeURIComponent(id));
  const chat=await response.json();
  if(!response.ok)throw new Error(chat.error||"Export failed.");

  const content=[
   "DCO CYBER AI - CONVERSATION",
   "Title: "+chat.title,
   "Date: "+new Date(chat.createdAt).toLocaleString(),
   "",
   ...chat.messages.map(m=>
    (m.role==="assistant"?"DCO CYBER AI":"USER")+":\n"+m.content+"\n"
   )
  ].join("\n");

  const blob=new Blob([content],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download=(chat.title||"DCO-chat")
   .replace(/[^a-z0-9-_]/gi,"_")+".txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
 }catch(error){
  alert(error.message);
 }
}

async function renameChat(id,currentTitle){
 const title=prompt("Enter a new conversation title:",currentTitle);
 if(title===null)return;
 if(!title.trim()){
  alert("Title cannot be empty.");
  return;
 }
 try{
  const response=await apiFetch("/api/chats/"+encodeURIComponent(id),{
   method:"PATCH",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({title:title.trim()})
  });
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||"Rename failed.");
  await loadChatHistory();
 }catch(error){
  alert(error.message);
 }
}

async function openChat(id){
 try{
  const response=await apiFetch("/api/chats/"+encodeURIComponent(id));
  const chat=await response.json();
  if(!response.ok)throw new Error(chat.error||"Unable to open chat.");
  currentChatId=chat.id;
  messages.innerHTML="";
  welcome.style.display="none";
  suggestions.style.display="none";
  chat.messages.forEach(m=>addMessage(m.content,m.role==="assistant"?"assistant":"user"));
  loadChatHistory();
  if(window.innerWidth<=700){
   document.getElementById("sidebar").classList.remove("open");
   document.getElementById("backdrop").classList.remove("show");
  }
 }catch(error){
  alert(error.message);
 }
}

async function deleteChat(id){
 if(!confirm("Delete this conversation permanently?"))return;
 try{
  const response=await apiFetch("/api/chats/"+encodeURIComponent(id),{method:"DELETE"});
  if(!response.ok)throw new Error("Could not delete conversation.");
  if(currentChatId===id)newChat();
  else loadChatHistory();
 }catch(error){
  alert(error.message);
 }
}

function useSuggestion(text){
 question.value=text;
 question.focus();
 sendMessage();
}


const analysisHistory=document.getElementById("analysisHistory");
const analysisHistorySearch=document.getElementById("analysisHistorySearch");

async function loadAnalysisHistory(){
 try{
  const response=await apiFetch("/api/analyses");
  if(!response.ok)throw new Error("Unable to load analysis history.");
  const items=await response.json();
  renderAnalysisHistory(items);
 }catch(error){
  analysisHistory.textContent=error.message;
 }
}

function renderAnalysisHistory(items){
 const query=(analysisHistorySearch.value||"").trim().toLowerCase();
 analysisHistory.innerHTML="";
 const filtered=items.filter(item=>
  (item.title+" "+(item.filenames||[]).join(" ")).toLowerCase().includes(query)
 );

 if(!filtered.length){
  analysisHistory.textContent=query?"No matching analyses.":"No saved analyses yet.";
  return;
 }

 filtered.forEach(item=>{
  const row=document.createElement("div");
  row.className="history-item";
  row.style.flexWrap="wrap";

  const open=document.createElement("button");
  open.className="history-open";
  open.textContent=item.title+" · "+new Date(item.createdAt).toLocaleDateString();
  open.onclick=()=>openSavedAnalysis(item.id);

  const pdf=document.createElement("button");
  pdf.className="history-delete";
  pdf.textContent="PDF";
  pdf.title="Download PDF report";
  pdf.onclick=()=>{
   downloadAnalysisPdf(item.id, "analysis-report.pdf")
    .catch(error=>alert(error.message));
  };

  const remove=document.createElement("button");
  remove.className="history-delete";
  remove.textContent="×";
  remove.title="Delete saved analysis";
  remove.onclick=()=>deleteSavedAnalysis(item.id);

  row.append(open,pdf,remove);
  analysisHistory.appendChild(row);
 });
}

async function openSavedAnalysis(id){
 try{
  const response=await apiFetch("/api/analyses/"+encodeURIComponent(id));
  const item=await response.json();
  if(!response.ok)throw new Error(item.error||"Unable to open analysis.");

  welcome.style.display="none";
  suggestions.style.display="none";
  messages.innerHTML="";

  addMessage("Saved analysis: "+item.title,"user");
  addMessage(item.analysis,"assistant");

  (Array.isArray(item.qaHistory) ? item.qaHistory : []).forEach(entry=>{
   if(entry && typeof entry.content==="string"){
    addMessage(entry.content,entry.role==="assistant"?"assistant":"user");
   }
  });

  if(item.documentText){
   const panel=document.createElement("div");
   panel.style.cssText="padding:14px;margin:12px 0;background:#252525;border:1px solid #555;border-radius:12px;";

   const heading=document.createElement("strong");
   heading.textContent="Ask questions about these documents";
   heading.style.display="block";
   heading.style.marginBottom="10px";

   const input=document.createElement("textarea");
   input.placeholder="Ask a follow-up question...";
   input.maxLength=2000;
   input.rows=3;
   input.style.cssText="width:100%;box-sizing:border-box;padding:10px;border-radius:8px;background:#171717;color:white;border:1px solid #555;";

   const send=document.createElement("button");
   send.type="button";
   send.textContent="Ask question";
   send.style.cssText="margin-top:8px;padding:10px 14px;border:0;border-radius:8px;cursor:pointer;";

   const status=document.createElement("div");
   status.style.cssText="margin-top:10px;white-space:pre-wrap;";

   send.onclick=()=>sendSavedAnalysisQuestion(id,input,send,status);
   input.addEventListener("keydown",event=>{
    if(event.key==="Enter" && !event.shiftKey){
     event.preventDefault();
     sendSavedAnalysisQuestion(id,input,send,status);
    }
   });

   panel.append(heading,input,send,status);
   messages.appendChild(panel);
   panel.scrollIntoView({behavior:"smooth",block:"nearest"});
  }
 }catch(error){
  alert(error.message);
 }
}

async function sendSavedAnalysisQuestion(id,input,send,status){
 const questionText=input.value.trim();
 if(!questionText || send.disabled)return;

 send.disabled=true;
 status.textContent="Searching the saved document contents...";

 try{
  const response=await apiFetch("/api/analyses/"+encodeURIComponent(id)+"/questions",{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({question:questionText})
  });

  const data=await response.json();
  if(!response.ok)throw new Error(data.error||"Unable to answer question.");

  addMessage(questionText,"user");
  addMessage(data.answer||"No answer returned.","assistant");
  input.value="";
  status.textContent="";
 }catch(error){
  status.textContent="Error: "+error.message;
 }finally{
  send.disabled=false;
 }
}

async function deleteSavedAnalysis(id){
 if(!confirm("Delete this saved analysis?"))return;
 try{
  const response=await apiFetch("/api/analyses/"+encodeURIComponent(id),{method:"DELETE"});
  if(!response.ok)throw new Error("Unable to delete analysis.");
  await loadAnalysisHistory();
 }catch(error){
  alert(error.message);
 }
}

analysisHistorySearch.addEventListener("input",loadAnalysisHistory);

function addMessage(text,type){
 const box=document.createElement("div");
 box.className="message "+type;
 const content=document.createElement("div");
 content.textContent=text;
 box.appendChild(content);

 if(type==="assistant"){
  const actions=document.createElement("div");
  actions.className="message-actions";
  const copy=document.createElement("button");
  copy.textContent="Copy";
  copy.onclick=()=>navigator.clipboard?.writeText(text);
  const listen=document.createElement("button");
  listen.textContent="🔊 Listen";
  listen.onclick=()=>speak(text);
  actions.append(copy,listen);
  box.appendChild(actions);
 }
 messages.appendChild(box);
 box.scrollIntoView({behavior:"smooth",block:"nearest"});
 return box;
}

function speak(text){
 if(!("speechSynthesis" in window)){
  alert("Speech playback is not supported by this browser.");
  return;
 }
 speechSynthesis.cancel();
 const utterance=new SpeechSynthesisUtterance(text);
 utterance.lang="en";
 utterance.rate=1;
 speechSynthesis.speak(utterance);
}

speakToggle.onclick=()=>{
 voiceEnabled=!voiceEnabled;
 speakToggle.textContent=voiceEnabled?"🔊 Voice on":"🔇 Voice off";
 if(!voiceEnabled && window.speechSynthesis) speechSynthesis.cancel();
};

let activeChatController = null;

async function sendMessage(){
 const text=question.value.trim();

 if(!text || activeChatController)return;

 if(!currentChatId){
  try{
   const created=await apiFetch("/api/chats",{method:"POST"});
   const chat=await created.json();

   if(!created.ok)throw new Error(chat.error||"Could not create chat.");

   currentChatId=chat.id;
  }catch(error){
   alert("Unable to start chat: "+error.message);
   return;
  }
 }

 welcome.style.display="none";
 suggestions.style.display="none";

 addMessage(text,"user");
 question.value="";

 activeChatController=new AbortController();

 send.disabled=false;
 send.textContent="Stop ■";
 send.classList.add("stop");

 const loading=addMessage("","assistant");
 let answer="";
 let completed=false;

 try{
  const response=await apiFetch("/api/chat",{
   method:"POST",
   signal:activeChatController.signal,
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({
    message:text,
    chatId:currentChatId,
    mode:aiMode.value,
    model:aiModel.value
   })
  });

  if(!response.ok){
   const data=await response.json();
   throw new Error(data.error||"Request failed.");
  }

  const reader=response.body.getReader();
  const decoder=new TextDecoder();

  let buffer="";
  let eventName="";

  function processStreamLine(line){
   if(line.startsWith("event:")){
    eventName=line.slice(6).trim();
    return;
   }

   if(!line.startsWith("data:"))return;

   const payload=line.slice(5).trim();

   try{
    const data=JSON.parse(payload);

    if(eventName==="token"){
     answer+=data.token||"";
     loading.firstChild.textContent=answer;
     loading.scrollIntoView({behavior:"smooth",block:"nearest"});
    }

    if(eventName==="done"){
     completed=true;
    }

    if(eventName==="error"){
     throw new Error(data.error||"Streaming failed.");
    }
   }finally{
    eventName="";
   }
  }

  while(true){
   const {done,value}=await reader.read();

   if(done)break;

   buffer+=decoder.decode(value,{stream:true});

   const lines=buffer.split("\n");
   buffer=lines.pop()||"";

   for(const line of lines){
    if(line.trim()===""){
     eventName="";
    }else{
     processStreamLine(line.trimEnd());
    }
   }
  }

  buffer+=decoder.decode();

  if(buffer.trim()){
   processStreamLine(buffer.trimEnd());
  }

  if(!answer){
   loading.firstChild.textContent="No response received.";
  }

  if(completed && voiceEnabled && answer){
   speak(answer);
  }

 }catch(error){
  if(error.name==="AbortError"){
   if(!answer){
    loading.firstChild.textContent="Generation stopped.";
   }
  }else if(answer){
   loading.firstChild.textContent=answer+"\n\nResponse interrupted: "+error.message;
  }else{
   loading.firstChild.textContent="Unable to connect: "+error.message;
  }
 }finally{
  activeChatController=null;
  send.disabled=false;
  send.textContent="Send ↑";
  send.classList.remove("stop");

  loadChatHistory();
  question.focus();
 }
}

send.onclick=()=>{
 if(activeChatController){
  activeChatController.abort();
 }else{
  sendMessage();
 }
};
question.addEventListener("keydown",e=>{
 if(e.key==="Enter"&&!e.shiftKey){
  e.preventDefault();
  sendMessage();
 }
});

const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SpeechRecognition){
 recognition=new SpeechRecognition();
 recognition.lang="en-NG";
 recognition.interimResults=false;
 recognition.onstart=()=>mic.textContent="🎙 Listening...";
 recognition.onend=()=>mic.textContent="🎙 Voice";
 recognition.onresult=event=>{
  question.value+=(question.value?" ":"")+event.results[0][0].transcript;
  question.focus();
 };
 recognition.onerror=()=>mic.textContent="🎙 Try again";
 mic.onclick=()=>recognition.start();
}else{
 mic.onclick=()=>alert("Voice input is not supported in this browser. Try an updated Chrome browser.");
}

