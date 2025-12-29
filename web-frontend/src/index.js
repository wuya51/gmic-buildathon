import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./App.css";
import App from "./App";
import { BrowserRouter, Route, Routes, useParams, useSearchParams } from "react-router-dom";
import GraphQLProvider from "./providers/GraphQLProvider";
import { WalletProvider } from './providers';
import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    const isCriticalError = !(
      error?.message?.includes('ApolloError') ||
      error?.message?.includes('Network error') ||
      error?.message?.includes('502') ||
      error?.message?.includes('503') ||
      error?.message?.includes('504') ||
      error?.name?.includes('ApolloError')
    );
    
    if (isCriticalError) {
      console.error('Critical error caught by ErrorBoundary:', error);
      return { hasError: true, error };
    } else {
      console.warn('Non-critical error ignored by ErrorBoundary:', error?.message);
      return { hasError: false, error: null };
    }
  }

  componentDidCatch(error, errorInfo) {
    const isCriticalError = !(
      error?.message?.includes('ApolloError') ||
      error?.message?.includes('Network error') ||
      error?.message?.includes('502') ||
      error?.message?.includes('503') ||
      error?.message?.includes('504') ||
      error?.name?.includes('ApolloError')
    );
    
    if (isCriticalError) {
      console.error("Critical error caught by ErrorBoundary:", error, errorInfo);
    } else {
      console.warn('Non-critical error ignored by ErrorBoundary:', error?.message);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-container">
          <header className="app-header">
            <h1 className="app-title">Linera GM Demo</h1>
          </header>
          <main className="main-content">
            <div className="game-setup">
              <h2>Application Error</h2>
              <p>Sorry, the application encountered an error:</p>
              <pre style={{ color: 'red', overflow: 'auto' }}>
                {this.state.error && this.state.error.toString()}
              </pre>
              <p>Please refresh the page to try again, or check if the URL parameters are correct.</p>
            </div>
          </main>
        </div>
      );
    }

    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DefaultGraphQLApp />} />
          <Route path=":id" element={<GraphQLApp />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
);

function DefaultGraphQLApp() {
  // Read configuration parameters from environment variables
  const CHAIN_ID = import.meta.env.VITE_CHAIN_ID || "9bfde0d7516716607d52f2c18a0aadcbf58ef6c4543a4dce68625d669e7a7e9d";
  const APP_ID = import.meta.env.VITE_APP_ID || "e8cba958bd6cc630678d12986534dc84f3a529171353621c4644a49d284e69b4";
  const OWNER_ID = import.meta.env.VITE_OWNER_ID || "0x215115530daaada3b012212ac2472e3c3cbcfaa0149a8bfa59e051005cbeb851";
  const PORT = import.meta.env.VITE_PORT || "8080";

  const HOST = import.meta.env.VITE_HOST || "gmic.top";
  
  try {
    
    return (
      <ErrorBoundary>
        <DynamicContextProvider
          settings={{
            environmentId: '2a6a2498-e013-4b1b-983a-cb2a53cd7d9d',
            appName: 'GM App',
            initialAuthenticationMode: 'connect-only',
            walletConnectors: [EthereumWalletConnectors],
            events: {
              onAuthSuccess: (event) => {
              },
              onAuthError: (error) => {
              },
              onLogout: () => {
              }
            }
          }}
        >
          <WalletProvider appChainId={CHAIN_ID}>
            <GraphQLProvider 
              chainId={CHAIN_ID} 
              applicationId={APP_ID} 
              ownerId={OWNER_ID} 
              port={PORT}
              host={HOST}
            >
              <App 
                chainId={CHAIN_ID} 
                ownerId={OWNER_ID} 
                appId={APP_ID}
                appChainId={CHAIN_ID}
              />
            </GraphQLProvider>
          </WalletProvider>
        </DynamicContextProvider>
      </ErrorBoundary>
    );
  } catch (error) {
    return (
      <div className="app-container">
        <header className="app-header">
          <h1 className="app-title">Linera GM Demo</h1>
        </header>
        <main className="main-content">
          <div className="game-setup">
            <h2>Application Initialization Error</h2>
            <p>Sorry, the application encountered an error during initialization:</p>
            <pre style={{ color: 'red', overflow: 'auto' }}>
              {error && error.toString()}
            </pre>
            <p>Please refresh the page to try again, or check if the URL parameters are correct.</p>
          </div>
        </main>
      </div>
    );
  }
}

function GraphQLApp() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  
  try {
    const CHAIN_ID = id;
    const APP_ID = searchParams.get("app") || import.meta.env.VITE_APP_ID;
    const OWNER_ID = searchParams.get("owner") || import.meta.env.VITE_OWNER_ID;
    const PORT = searchParams.get("port") || import.meta.env.VITE_PORT || "8080";
    const HOST = searchParams.get("host") || import.meta.env.VITE_HOST || "localhost";
    
    return (
      <ErrorBoundary>
        <DynamicContextProvider
          settings={{
            environmentId: '2a6a2498-e013-4b1b-983a-cb2a53cd7d9d',
            appName: 'GM App',
            initialAuthenticationMode: 'connect-only',
            walletConnectors: [EthereumWalletConnectors],
            events: {
              onAuthSuccess: (event) => {
              },
              onAuthError: (error) => {
              },
              onLogout: () => {
              }
            }
          }}
        >
          <WalletProvider appChainId={CHAIN_ID}>
            <GraphQLProvider 
              chainId={CHAIN_ID} 
              applicationId={APP_ID} 
              ownerId={OWNER_ID} 
              port={PORT}
              host={HOST}
            >
              <App 
                chainId={CHAIN_ID} 
                ownerId={OWNER_ID} 
                appId={APP_ID}
                appChainId={CHAIN_ID}
              />
            </GraphQLProvider>
          </WalletProvider>
        </DynamicContextProvider>
      </ErrorBoundary>
    );
  } catch (error) {
    return (
      <div className="app-container">
        <header className="app-header">
          <h1 className="app-title">Linera GM Demo</h1>
        </header>
        <main className="main-content">
          <div className="game-setup">
            <h2>Application Initialization Error</h2>
            <p>Sorry, the application encountered an error during initialization:</p>
            <pre style={{ color: 'red', overflow: 'auto' }}>
              {error && error.toString()}
            </pre>
            <p>Please refresh the page to try again, or check if the URL parameters are correct.</p>
          </div>
        </main>
      </div>
    );
  }
}