import { NavLink, Route, Routes } from 'react-router';

function Header() {
  return (
    <header className="header">
      <NavLink to="/" className="brand">
        Календарь звонков
      </NavLink>
      <nav className="nav" aria-label="Основная навигация">
        <NavLink to="/book">Записаться</NavLink>
        <NavLink to="/admin">Админка</NavLink>
      </nav>
    </header>
  );
}

function HomePage() {
  return (
    <section className="hero">
      <div className="hero-text">
        <span className="badge">БЫСТРАЯ ЗАПИСЬ НА ЗВОНОК</span>
        <h1>Calendar</h1>
        <p>
          Забронируйте встречу за минуту: выберите тип события и удобное время.
        </p>
        <NavLink to="/book" className="button">
          Записаться →
        </NavLink>
      </div>
      <aside className="card">
        <h2>Возможности</h2>
        <ul>
          <li>Выбор типа события и удобного времени для встречи.</li>
          <li>
            Быстрое бронирование с подтверждением и дополнительными заметками.
          </li>
          <li>
            Управление типами встреч и просмотр предстоящих записей в админке.
          </li>
        </ul>
      </aside>
    </section>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <section className="card">
      <h1>{title}</h1>
    </section>
  );
}

function App() {
  return (
    <>
      <Header />
      <main className="page">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/book/*" element={<Placeholder title="Записаться" />} />
          <Route path="/admin/*" element={<Placeholder title="Админка" />} />
          <Route
            path="*"
            element={<Placeholder title="Страница не найдена" />}
          />
        </Routes>
      </main>
    </>
  );
}

export default App;
