import { useState } from "react";
import Sidebar from "./Sidebar";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Layout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-brand-dark text-slate-100 overflow-x-hidden">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

      <main className={`flex-1 transition-all duration-300 p-8 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        {children}
      </main>

      {/* Toggle Button Floating */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`fixed top-6 z-[60] transition-all duration-300 bg-slate-900 border border-white/10 p-1.5 rounded-lg text-slate-500 hover:text-white shadow-xl ${isCollapsed ? 'left-24' : 'left-60'}`}
      >
        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </div>
  );
}