import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Beneficiarios } from './pages/Beneficiarios'
import { FichaBeneficiario } from './pages/FichaBeneficiario'
import { Financeiro } from './pages/Financeiro' // Refactored as Caderno de Fechamento
import { Aluguel } from './pages/Aluguel'
import { AluguelForm } from './pages/AluguelForm'
import { Cestas } from './pages/Cestas'
import { CestaForm } from './pages/CestaForm'
import { Mensagens } from './pages/Mensagens'
import { Relatorios } from './pages/Relatorios'
import { Usuarios } from './pages/Usuarios'
import { Configuracoes } from './pages/Configuracoes'
import { AnotacoesRetirada } from './pages/AnotacoesRetirada'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes nested in Layout */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/beneficiarios" element={
          <ProtectedRoute>
            <Layout>
              <Beneficiarios />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/beneficiarios/:id" element={
          <ProtectedRoute>
            <Layout>
              <FichaBeneficiario />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/cestas" element={
          <ProtectedRoute>
            <Layout>
              <Cestas />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/cestas/:id" element={
          <ProtectedRoute>
            <Layout>
              <CestaForm />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/cestas/novo" element={
          <ProtectedRoute>
            <Layout>
              <CestaForm />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/aluguel" element={
          <ProtectedRoute>
            <Layout>
              <Aluguel />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/aluguel/:id" element={
          <ProtectedRoute>
            <Layout>
              <AluguelForm />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/aluguel/novo" element={
          <ProtectedRoute>
            <Layout>
              <AluguelForm />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/mensagens" element={
          <ProtectedRoute>
            <Layout>
              <Mensagens />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/financeiro" element={
          <ProtectedRoute>
            <Layout>
              <Financeiro />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/relatorios" element={
          <ProtectedRoute>
            <Layout>
              <Relatorios />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/usuarios" element={
          <ProtectedRoute>
            <Layout>
              <Usuarios />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/configuracoes" element={
          <ProtectedRoute>
            <Layout>
              <Configuracoes />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/retiradas" element={
          <ProtectedRoute>
            <Layout>
              <AnotacoesRetirada />
            </Layout>
          </ProtectedRoute>
        } />

        {/* Redirect unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
