from pathlib import Path
import re

p = Path("public/index.html")
s = p.read_text()

def replace(old, new, label):
    global s
    if old not in s:
        raise SystemExit("STOP: Missing " + label + ". Original file unchanged.")
    s = s.replace(old, new, 1)
    print("Updated:", label)

replace(
    '<div class="app">',
    '<div class="app" id="mainWorkspace" style="display:none">',
    "workspace visibility"
)

replace(
    '<div class="sidebar-bottom">',
    '<div class="sidebar-bottom">\n'
    '    <button id="signOutButton" class="newchat" type="button">Sign out</button>',
    "sign-out button"
)

replace(
    'let supabaseClient = null;\nlet authMode = "login";',
    '''let supabaseClient = null;
let authMode = "login";

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
}''',
    "authenticated request and workspace helpers"
)

start = s.find("async function initialiseSupabaseAuth() {")
marker = "updateAuthForm();\ninitialiseSupabaseAuth();"
end = s.find(marker, start)

if start < 0 or end < 0:
    raise SystemExit("STOP: Authentication initializer not found. No file written.")

initializer = '''async function initialiseSupabaseAuth() {
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
initialiseSupabaseAuth();'''

s = s[:start] + initializer + s[end + len(marker):]
print("Updated: authentication initializer")

s = s.replace(
    'showAuthMessage("Sign-in successful. Your private workspace is being secured before access is enabled.");',
    'showAuthMessage("Sign-in successful. Opening your private workspace...");',
    1
)

replace(
    'initialiseSupabaseAuth();',
    '''initialiseSupabaseAuth();

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
});''',
    "sign-out handler"
)

s, count = re.subn(
    r'(?<![\w.])fetch\((?!"/api/config")(?=["/])',
    'apiFetch(',
    s
)
if count < 10:
    raise SystemExit(f"STOP: Only {count} API requests matched. No file written.")
print("Protected private API requests:", count)

pdf_pattern = re.compile(
    r'const pdfLink=document\.createElement\("a"\);\s*'
    r'pdfLink\.href="/api/analyses/"\+encodeURIComponent\(data\.id\)\+"/pdf";\s*'
    r'pdfLink\.textContent="Download PDF report";\s*'
    r'pdfLink\.className="history-delete";\s*'
    r'pdfLink\.style\.display="inline-block";\s*'
    r'pdfLink\.style\.marginTop="8px";\s*'
    r'loading\.appendChild\(pdfLink\);'
)

pdf_replacement = '''const pdfLink=document.createElement("button");
  pdfLink.type="button";
  pdfLink.textContent="Download PDF report";
  pdfLink.className="history-delete";
  pdfLink.style.display="inline-block";
  pdfLink.style.marginTop="8px";
  pdfLink.onclick=()=>downloadAnalysisPdf(data.id).catch(error=>alert(error.message));
  loading.appendChild(pdfLink);'''

s, pdf_count = pdf_pattern.subn(pdf_replacement, s)
if pdf_count != 2:
    raise SystemExit(f"STOP: Expected 2 PDF links, found {pdf_count}. No file written.")
print("Converted PDF links:", pdf_count)

replace(
    '''  pdf.onclick=()=>{
   const link=document.createElement("a");
   link.href="/api/analyses/"+encodeURIComponent(item.id)+"/pdf";
   link.download="";
   document.body.appendChild(link);
   link.click();
   link.remove();
  };''',
    '''  pdf.onclick=()=>{
   downloadAnalysisPdf(item.id, "analysis-report.pdf")
    .catch(error=>alert(error.message));
  };''',
    "history PDF download"
)

replace('\nloadAIModels();\n', '\n', "initial model loader")
replace(
    'analysisHistorySearch.addEventListener("input",loadAnalysisHistory);\nloadAnalysisHistory();',
    'analysisHistorySearch.addEventListener("input",loadAnalysisHistory);',
    "initial analysis history loader"
)
replace('\nloadChatHistory();\n</script>', '\n</script>', "initial chat history loader")

p.write_text(s)
print("\\nMain authentication patch saved.")
