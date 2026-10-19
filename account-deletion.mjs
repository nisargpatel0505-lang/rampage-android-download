import { createDeletionController } from "./deletion-controller.mjs";

const el = (id) => document.getElementById(id);
const verify = el("verify"), intent = el("intent"), confirmation = el("confirmation");
const confirmIntent = el("confirm-intent"), deleteButton = el("delete"), cancel = el("cancel");
const status = el("status"), verification = el("verification"), identity = el("identity");
let controller, ready = false, state = "idle";
function update(view) {
  state = view.state;
  const locked = state === "busy" || state === "deleting";
  const confirming = state === "confirm" || state === "deleting";
  verification.hidden = confirming || state === "complete";
  confirmation.hidden = !confirming;
  verify.disabled = !ready || locked || !intent.checked;
  intent.disabled = locked;
  confirmIntent.disabled = locked;
  if (state === "confirm") confirmIntent.checked = false;
  deleteButton.disabled = locked || !confirmIntent.checked;
  cancel.disabled = locked;
  identity.textContent = view.email || "Verified Google account";
  status.textContent = view.message;
  status.classList.toggle("error", view.error === true);
}
intent.addEventListener("change", () => { verify.disabled = !ready || state !== "idle" || !intent.checked; });
confirmIntent.addEventListener("change", () => { deleteButton.disabled = state !== "confirm" || !confirmIntent.checked; });
verify.addEventListener("click", () => controller?.verify(intent.checked));
deleteButton.addEventListener("click", () => controller?.confirm(confirmIntent.checked));
cancel.addEventListener("click", () => controller?.cancel());

try {
  const [appSdk, authSdk, response] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js"),
    fetch("./web-auth-config.json", { cache: "no-store", credentials: "omit" })
  ]);
  if (!response.ok) throw new Error("Configuration unavailable");
  const config = await response.json();
  if (!config.apiKey || config.projectId !== "rampage-arcade-0505" || config.authDomain !== "rampage-arcade-0505.firebaseapp.com") throw new Error("Invalid configuration");
  const app = appSdk.initializeApp(config, "rampage-account-deletion");
  // initializeAuth avoids loading an earlier persistent session before switching storage.
  const auth = authSdk.initializeAuth(app, { persistence: authSdk.inMemoryPersistence, popupRedirectResolver: authSdk.browserPopupRedirectResolver });
  auth.useDeviceLanguage();
  const provider = new authSdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  controller = createDeletionController({
    authenticate: async () => {
      const result = await authSdk.signInWithPopup(auth, provider);
      return { user: result.user, isNewUser: authSdk.getAdditionalUserInfo(result)?.isNewUser === true };
    },
    removeUser: (user) => authSdk.deleteUser(user),
    signOut: () => authSdk.signOut(auth),
    update
  });
  ready = true;
  update({ state: "idle", message: "Check the box above, then verify the Google account you used in RAMPAGE." });
} catch {
  ready = false;
  update({ state: "idle", error: true, message: "Web verification is unavailable. You can still request deletion by email below." });
}
