window.dcoAuthReady = (async function () {
  function redirectToLogin() {
    if (window.location.pathname !== "/") {
      window.location.replace("/");
    }
  }

  try {
    if (!window.supabase) {
      throw new Error("Supabase client library is unavailable.");
    }

    const response = await fetch("/api/config");
    if (!response.ok) {
      throw new Error("Unable to load authentication configuration.");
    }

    const config = await response.json();

    const client = window.supabase.createClient(
      config.supabaseUrl,
      config.supabasePublishableKey
    );

    window.dcoSupabase = client;

    const { data, error } = await client.auth.getSession();

    if (error || !data.session ||
        !data.session.user.email_confirmed_at) {
      redirectToLogin();
      throw new Error("Please sign in with a verified account.");
    }

    window.dcoApiFetch = async function (url, options = {}) {
      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      const session = sessionData && sessionData.session;

      if (sessionError || !session ||
          !session.user.email_confirmed_at) {
        redirectToLogin();
        throw new Error("Your session has expired. Please sign in again.");
      }

      const headers = new Headers(options.headers || {});
      headers.set("Authorization", "Bearer " + session.access_token);

      return fetch(url, {
        ...options,
        headers
      });
    };

    client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") redirectToLogin();
    });

    return true;
  } catch (error) {
    console.error("Authentication guard:", error.message);
    return false;
  }
})();
