import { NavLink, Route, Routes, useParams } from "react-router-dom";
import { isQuestionId } from "../shared/ids";
import { StatusBanner } from "./components/StatusBanner";
import { Answer } from "./pages/Answer";
import { History } from "./pages/History";
import { QuestionList } from "./pages/QuestionList";
import { Results } from "./pages/Results";
import { Stats } from "./pages/Stats";

function QuestionRoute({ view }: { view: "answer" | "results" }) {
  const { term, qno } = useParams();
  const id = `${term}/${qno}`;
  if (!isQuestionId(id)) return <div className="page">問題IDが不正です: {id}</div>;
  return view === "answer" ? <Answer key={id} id={id} /> : <Results key={id} id={id} />;
}

export function App() {
  return (
    <div className="app">
      <header className="nav">
        <span className="brand">AP午後</span>
        <NavLink to="/" end>
          問題
        </NavLink>
        <NavLink to="/history">履歴</NavLink>
        <NavLink to="/stats">集計</NavLink>
      </header>
      <StatusBanner />
      <main>
        <Routes>
          <Route path="/" element={<QuestionList />} />
          <Route path="/q/:term/:qno" element={<QuestionRoute view="answer" />} />
          <Route path="/q/:term/:qno/results" element={<QuestionRoute view="results" />} />
          <Route path="/history" element={<History />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="*" element={<div className="page">ページが見つかりません</div>} />
        </Routes>
      </main>
    </div>
  );
}
