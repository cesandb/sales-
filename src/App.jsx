import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard        from './pages/Dashboard'
import Contacts         from './pages/Contacts'
import Pipeline         from './pages/Pipeline'
import Followups        from './pages/Followups'
import Products         from './pages/Products'
import Templates        from './pages/Templates'
import Analytics        from './pages/Analytics'
import Goals            from './pages/Goals'
import Discover         from './pages/Discover'
import Reach            from './pages/Reach'
import Campaigns        from './pages/Campaigns'
import CommissionTracker from './pages/CommissionTracker'
import Settings         from './pages/Settings'
import Outreach         from './pages/Outreach'
import Coach            from './pages/Coach'
import Acquire          from './pages/Acquire'
import Sequences        from './pages/Sequences'
import Broadcast        from './pages/Broadcast'
import Deals            from './pages/Deals'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/"            element={<Dashboard />} />
        <Route path="/contacts"    element={<Contacts />} />
        <Route path="/pipeline"    element={<Pipeline />} />
        <Route path="/followups"   element={<Followups />} />
        <Route path="/products"    element={<Products />} />
        <Route path="/templates"   element={<Templates />} />
        <Route path="/analytics"   element={<Analytics />} />
        <Route path="/goals"       element={<Goals />} />
        <Route path="/discover"    element={<Discover />} />
        <Route path="/reach"       element={<Reach />} />
        <Route path="/campaigns"   element={<Campaigns />} />
        <Route path="/commissions" element={<CommissionTracker />} />
        <Route path="/settings"   element={<Settings />} />
        <Route path="/outreach"   element={<Outreach />} />
        <Route path="/coach"      element={<Coach />} />
        <Route path="/acquire"    element={<Acquire />} />
        <Route path="/sequences"  element={<Sequences />} />
        <Route path="/broadcast"  element={<Broadcast />} />
        <Route path="/deals"      element={<Deals />} />
      </Routes>
    </Layout>
  )
}
