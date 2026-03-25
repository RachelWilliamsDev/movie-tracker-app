import { AuthPanel } from "@/components/auth-panel";
import { SearchPanel } from "@/components/search-panel";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">MovieApp</h1>
      <p className="text-center text-gray-600">Sign up, log in, and manage session.</p>
      <AuthPanel />
      <SearchPanel />
    </main>
  );
}
