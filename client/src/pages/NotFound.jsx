import { Button } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-sm font-medium text-teal-700">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">This page doesn't exist</h1>
      <p className="mt-2 text-slate-500">The link may be broken, or the page may have moved.</p>
      <Button to="/" className="mt-6">
        Back to sessions
      </Button>
    </div>
  );
}
