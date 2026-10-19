// Only this controller can request account deletion. UI never receives credentials.
export function createDeletionController({ authenticate, removeUser, signOut, update }) {
  let account = null;
  let busy = false;
  const show = (state, message, error = false) => update({ state, message, error, email: account?.email || "" });
  const friendly = (error) => {
    switch (error?.code) {
      case "auth/popup-closed-by-user": case "auth/cancelled-popup-request": return "Verification cancelled. No account was deleted.";
      case "auth/popup-blocked": return "Allow the Google sign-in popup, or use the email request below.";
      case "auth/network-request-failed": return "Could not connect. Check your connection or use the email request below.";
      case "auth/requires-recent-login": return "Verification has expired. Cancel and sign in again, then retry deletion.";
      case "auth/user-disabled": return "This account cannot sign in. Please use the email request below.";
      case "auth/unauthorized-domain": case "auth/operation-not-allowed": case "auth/invalid-api-key": case "auth/app-not-authorized": return "Web verification is unavailable for this site. Please request deletion by email below.";
      default: return "The action could not be confirmed. Please try again or use the email request below.";
    }
  };
  return {
    async verify(consent) {
      if (busy || account || !consent) return false;
      busy = true; show("busy", "Opening Google verification…");
      try {
        const result = await authenticate();
        if (!result?.user?.uid) throw new Error("Missing verified identity");
        account = result.user;
        if (result.isNewUser) {
          // Consent covers removal of an identity created solely by this verification.
          show("busy", "No existing RAMPAGE account found. Removing the temporary verification identity…");
          await removeUser(account);
          account = null;
          show("complete", "No existing RAMPAGE account was found. The temporary verification identity has been removed. Your Google account and local game progress are unchanged.");
        } else show("confirm", "Verified. Review the selected account before confirming deletion.");
        return true;
      } catch (error) {
        show(account ? "confirm" : "idle", friendly(error), true);
        return false;
      } finally { busy = false; }
    },
    async confirm(consent) {
      if (busy || !account || !consent) return false;
      busy = true; show("deleting", "Deleting your RAMPAGE account…");
      try {
        await removeUser(account);
        account = null;
        show("complete", "Your RAMPAGE account has been deleted. Your Google account and local game progress are unchanged.");
        return true;
      } catch (error) { show("confirm", friendly(error), true); return false; }
      finally { busy = false; }
    },
    async cancel() {
      if (busy) return false;
      busy = true;
      try { await signOut(); account = null; show("idle", "Signed out. No account was deleted."); return true; }
      catch (error) { show(account ? "confirm" : "idle", "Could not confirm sign-out. Close this page to clear this browser session.", true); return false; }
      finally { busy = false; }
    }
  };
}
