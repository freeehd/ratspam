'use client';

import { useState, useEffect } from 'react';

interface ListStatus {
  list: string;
  status: string;
}

interface StandardsCompliance {
  reverseHostname: string;
  namingConvention: string;
}

interface IPLookupResponse {
  ip: string;
  standardsCompliance: StandardsCompliance;
  listStatuses: ListStatus[];
}

export default function IPLookup() {
  const [activeTab, setActiveTab] = useState<'input' | 'processing'>('input');
  const [ipsInput, setIpsInput] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [ips, setIps] = useState<string[]>([]);
  const [results, setResults] = useState<IPLookupResponse[]>([]);
  const [failedIps, setFailedIps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentIpIndex, setCurrentIpIndex] = useState<number>(-1);
  const [expandedIps, setExpandedIps] = useState<Set<string>>(new Set());
  const [darkMode, setDarkMode] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Parse IPs from textarea input
  const parseIps = (input: string): string[] => {
    return input
      .split('\n')
      .map(ip => ip.trim())
      .filter(ip => ip.length > 0);
  };

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setIpsInput(event.target.result as string);
        }
      };
      reader.readAsText(selectedFile);
    }
  };

  // Toggle expandable view for an IP
  const toggleExpand = (ip: string) => {
    setExpandedIps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ip)) {
        newSet.delete(ip);
      } else {
        newSet.add(ip);
      }
      return newSet;
    });
  };

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Process IPs linearly
  const processIps = async (ipsToProcess: string[]) => {
    setIsProcessing(true);
    setError(null);
    setFailedIps([]);

    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    const invalidIps = ipsToProcess.filter(ip => !ipRegex.test(ip));
    if (invalidIps.length > 0) {
      setError(`Invalid IP addresses: ${invalidIps.join(', ')}`);
      showToast(`❌ Invalid IP addresses`, 'error');
      setIsProcessing(false);
      return;
    }

    const newResults: IPLookupResponse[] = [];
    const failed: string[] = [];

    for (let i = 0; i < ipsToProcess.length; i++) {
      setCurrentIpIndex(i);
      try {
        const res = await fetch('/api/iplookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ips: [ipsToProcess[i]] })
        });

        if (!res.ok) throw new Error(`API error`);

        const data = await res.json();
        newResults.push(...(data as IPLookupResponse[]));
      } catch (err) {
        failed.push(ipsToProcess[i]);
        setError(`Some IPs failed`);
      }

      setResults([...newResults]);
      setFailedIps(failed);
    }

    setIsProcessing(false);
    setCurrentIpIndex(-1);
    if (failed.length === 0) {
      showToast(`✅ IP lookup completed successfully`, 'success');
    } else {
      showToast(`⚠️ Some IPs failed. Use "Retry Failed" to try again.`, 'error');
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedIps = parseIps(ipsInput);
    if (parsedIps.length === 0) {
      setError('Please provide at least one IP address');
      showToast(`❌ Please provide at least one IP address`, 'error');
      return;
    }
    setIps(parsedIps);
    setActiveTab('processing');
    processIps(parsedIps);
  };

  // Reset form
  const handleReset = () => {
    setIpsInput('');
    setFile(null);
    setIps([]);
    setResults([]);
    setError(null);
    setIsProcessing(false);
    setCurrentIpIndex(-1);
    setExpandedIps(new Set());
    setFailedIps([]);
    setActiveTab('input');
  };

  // Export results to CSV
  const exportToCSV = () => {
    if (!results.length) return;

    const headers = ['IP', 'Reverse Hostname', 'Naming Convention', 'List Status'].join(',');

    const rows = results.map((result) => {
      const listStatuses = result.listStatuses
        .map((status) => `${status.list}:${status.status}`)
        .join('|');
      return [
        `"${result.ip}"`,
        `"${result.standardsCompliance.reverseHostname}"`,
        `"${result.standardsCompliance.namingConvention}"`,
        `"${listStatuses}"`,
      ].join(',');
    });

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ip_lookup_results_${new Date().toISOString().slice(0, 10)}.csv`);
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 px-4 py-2 rounded-md shadow-lg z-50 text-white max-w-xs transition-opacity duration-300 ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="max-w-3xl w-full bg-white dark:bg-gray-800 shadow-xl rounded-xl p-6 transition-all duration-300">
        <h1 className="text-3xl font-extrabold text-center mb-6 bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
          IP Lookup Tool
        </h1>

        {/* Dark Mode Toggle */}
        <div className="flex justify-end mb-4">
          <label className="inline-flex items-center cursor-pointer">
            <span className="mr-2 text-sm text-gray-700 dark:text-gray-300">🌞</span>
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
              className="sr-only"
            />
            <div className="relative w-10 h-5 bg-gray-300 rounded-full">
              <div
                className={`absolute left-0 top-0 bottom-0 w-5 bg-white rounded-full shadow transform transition-transform ${
                  darkMode ? 'translate-x-5' : ''
                }`}
              ></div>
            </div>
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">🌙</span>
          </label>
        </div>

        {/* Tabs */}
        <div className="flex border-b mb-6">
          <button
            className={`flex-1 py-2 px-4 text-center font-semibold ${
              activeTab === 'input'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('input')}
            disabled={isProcessing}
          >
            Input IPs
          </button>
          <button
            className={`flex-1 py-2 px-4 text-center font-semibold ${
              activeTab === 'processing'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('processing')}
            disabled={isProcessing && results.length === 0}
          >
            Results
          </button>
        </div>

        {/* Input Tab */}
        {activeTab === 'input' && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Upload IP List (text file, one IP per line)
              </label>
              <input
                type="file"
                accept=".txt"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-100 dark:file:text-blue-800"
                disabled={isProcessing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Or Enter IPs (one per line)
              </label>
              <textarea
                value={ipsInput}
                onChange={(e) => setIpsInput(e.target.value)}
                placeholder="Enter IP addresses, one per line (e.g., 111.88.202.130)"
                className="border border-gray-300 dark:border-gray-600 rounded-md p-3 w-full h-32 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={isProcessing}
              />
            </div>
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isProcessing}
                className={`flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 px-4 rounded-md transition transform hover:scale-[1.02] ${
                  isProcessing ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : 'Lookup IPs'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold py-3 px-4 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Reset
              </button>
            </div>
          </form>
        )}

        {/* Results Tab */}
        {activeTab === 'processing' && (
          <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4">
            {ips.length === 0 && !isProcessing && !results.length && (
              <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
                No IPs to process. Please enter IPs in the Input tab.
              </p>
            )}
            {ips.length > 0 && (
              <>
                <h2 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
                  Processing IPs ({results.length}/{ips.length} completed)
                </h2>
                {isProcessing && (
                  <div className="mb-4">
                    <p className="text-gray-600 dark:text-gray-400">
                      Currently processing: {currentIpIndex >= 0 ? ips[currentIpIndex] : 'Starting...'}
                    </p>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${((currentIpIndex + 1) / ips.length) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                {results.map((result, index) => {
                  const isOnAnyList = result.listStatuses.some(status => status.status === 'On the list');

                  return (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                      <button
                        className="w-full text-left flex justify-between items-center px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => toggleExpand(result.ip)}
                      >
                        <span className="flex items-center space-x-3">
                          <span
                            className={`block w-3 h-3 rounded-full ${
                              isOnAnyList ? 'bg-red-500' : 'bg-green-500'
                            }`}
                            title={isOnAnyList ? 'IP is on at least one list' : 'IP is not on any list'}
                          ></span>
                          <span className="font-semibold text-gray-800 dark:text-gray-200">{result.ip}</span>
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 transform transition-transform duration-200">
                          {expandedIps.has(result.ip) ? '▼' : '▶'}
                        </span>
                      </button>
                      {expandedIps.has(result.ip) && (
                        <div className="bg-white dark:bg-gray-700 p-4 border-t border-gray-200 dark:border-gray-600">
                          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                            Information about {result.ip}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Below is the information we have on record about {result.ip}
                          </p>
                          <h4 className="text-md font-medium mt-4 text-gray-700 dark:text-gray-300">
                            Standards Compliance
                          </h4>
                          <p className="text-gray-600 dark:text-gray-400">
                            Reverse hostname resolution...{' '}
                            <span className={`font-medium ${result.standardsCompliance.reverseHostname.includes('Passed') ? 'text-green-600' : 'text-red-600'}`}>
                              {result.standardsCompliance.reverseHostname}
                            </span>
                          </p>
                          <p className="text-gray-600 dark:text-gray-400">
                            Naming convention compliance...{' '}
                            <span className={`font-medium ${result.standardsCompliance.namingConvention.includes('Passed') ? 'text-green-600' : 'text-red-600'}`}>
                              {result.standardsCompliance.namingConvention}
                            </span>
                          </p>
                          <h4 className="text-md font-medium mt-4 text-gray-700 dark:text-gray-300">
                            List Status
                          </h4>
                          {result.listStatuses.map((status, idx) => (
                            <p key={idx} className="text-gray-600 dark:text-gray-400">
                              {status.list} -{' '}
                              <span className={`font-medium ${status.status.includes('On') ? 'text-green-600' : 'text-gray-500 dark:text-gray-400'}`}>
                                {status.status}
                              </span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
            {failedIps.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-md">
                <p className="text-yellow-800 dark:text-yellow-300 font-medium">Some IPs failed:</p>
                <ul className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                  {failedIps.map((ip, i) => (
                    <li key={i}>{ip}</li>
                  ))}
                </ul>
                <button
                  onClick={() => processIps(failedIps)}
                  className="mt-2 px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                >
                  Retry Failed IPs
                </button>
              </div>
            )}
            {results.length > 0 && (
              <button
                onClick={exportToCSV}
                className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md transition"
              >
                Export Results
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 rounded-md text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}