/**
 * AuthButton — sign in / sign out control for the header nav.
 * Server component: reads the session server-side to avoid a client-side flash.
 * Shows a GitHub avatar + username when signed in, a "Sign in" link when not.
 */
import { auth, signIn, signOut } from '@/auth';
import Image from 'next/image';

/**
 * Renders the authentication button in the top-right navigation.
 * When signed in: shows avatar, display name, and a sign-out form.
 * When signed out: shows a "Sign in with GitHub" link.
 */
export async function AuthButton() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        {session.user.image && (
          <Image
            src={session.user.image}
            alt={session.user.name ?? 'User avatar'}
            width={28}
            height={28}
            className="rounded-full"
          />
        )}
        <span className="text-sm text-white/70 hidden sm:inline">
          {session.user.name}
        </span>
        <a href="/history" className="text-sm text-white/60 hover:text-white transition">
          History
        </a>
        {/* Use a form to call the server action — avoids client JS for sign-out */}
        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/' });
          }}
        >
          <button
            type="submit"
            className="text-sm text-white/40 hover:text-white/80 transition"
          >
            Sign out
          </button>
        </form>
      </div>
    );
  }

  return (
    <form
      action={async () => {
        'use server';
        await signIn('github');
      }}
    >
      <button
        type="submit"
        className="text-sm rounded-md border border-white/20 px-3 py-1 text-white/70 hover:border-white/50 hover:text-white transition"
      >
        Sign in with GitHub
      </button>
    </form>
  );
}
