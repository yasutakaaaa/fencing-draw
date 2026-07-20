import { useStore } from '../store/useStore';

export default function Footer() {
  const { openPrivacy } = useStore();
  return (
    <footer className="print:hidden py-6 text-center text-xs text-gray-400">
      <button className="hover:text-gray-600 hover:underline transition-colors" onClick={openPrivacy}>
        プライバシーポリシー
      </button>
      <span className="mx-2">·</span>
      © {new Date().getFullYear()} FencingDraw
    </footer>
  );
}
