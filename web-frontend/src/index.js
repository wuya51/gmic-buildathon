import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
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
        <div className="min-h-screen bg-gray-50">
              <header className="bg-white shadow-md py-4 px-6">
                <h1 className="text-2xl font-bold text-gray-800">Linera GM Demo</h1>
              </header>
              <main className="container mx-auto py-8 px-4">
                <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">Application Error</h2>
                  <p className="text-gray-700 mb-4">Sorry, the application encountered an error:</p>
                  <pre className="text-red-500 overflow-auto p-3 bg-gray-100 rounded-md mb-4">
                    {this.state.error && this.state.error.toString()}
                  </pre>
                  <p className="text-gray-700">Please refresh the page to try again, or check if the URL parameters are correct.</p>
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
  const CHAIN_ID = import.meta.env.VITE_CHAIN_ID;
  const APP_ID = import.meta.env.VITE_APP_ID;
  const OWNER_ID = import.meta.env.VITE_OWNER_ID;
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
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-md py-4 px-6">
          <h1 className="text-2xl font-bold text-gray-800">Linera GM Demo</h1>
        </header>
        <main className="container mx-auto py-8 px-4">
          <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Application Initialization Error</h2>
            <p className="text-gray-700 mb-4">Sorry, the application encountered an error during initialization:</p>
            <pre className="text-red-500 overflow-auto p-3 bg-gray-100 rounded-md mb-4">
              {error && error.toString()}
            </pre>
            <p className="text-gray-700">Please refresh the page to try again, or check if the URL parameters are correct.</p>
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
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-md py-4 px-6">
          <h1 className="text-2xl font-bold text-gray-800">Linera GM Demo</h1>
        </header>
        <main className="container mx-auto py-8 px-4">
          <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Application Initialization Error</h2>
            <p className="text-gray-700 mb-4">Sorry, the application encountered an error during initialization:</p>
            <pre className="text-red-500 overflow-auto p-3 bg-gray-100 rounded-md mb-4">
              {error && error.toString()}
            </pre>
            <p className="text-gray-700">Please refresh the page to try again, or check if the URL parameters are correct.</p>
          </div>
        </main>
      </div>
    );
  }
}