import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard  from './pages/Dashboard'
import Contacts   from './pages/Contacts'
import Pipeline   from './pages/Pipeline'
import Followups  from './pages/Followups'
import Products   from './pages/Products'
import Templates  from './pages/Templates'
import Analytics  from './pages/Analytics'
import Goals      from './pages/Goals'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/"          element={<Dashboard />} />
        <Route path="/contacts"  element={<Contacts />} />
        <Route path="/pipeline"  element={<Pipeline />} />
        <Route path="/followups" element={<Followups />} />
        <Route path="/products"  element={<Products />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/goals"     element={<Goals />} />
      </Routes>
    </Layout>
  )
}
