import { Button } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="gold-text font-display text-8xl">404</p>
      <h1 className="mt-4 font-display text-3xl text-ink">This page doesn't exist</h1>
      <p className="mt-2 text-muted">The link may be broken, or the page may have moved.</p>
      <Button to="/" className="mt-6">
        Back to sessions
      </Button>
    </div>
  );
}
