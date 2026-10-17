import { Routes, Route } from "react-router-dom";
import Orchestrator from "@/pages/Orchestrator";
import Home from "@/pages/Home";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Orchestrator />} />
      <Route path="/workbench" element={<Home />} />
    </Routes>
  );
}


