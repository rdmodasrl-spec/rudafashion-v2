import React, { useEffect, useId, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { apiRequest } from '../../../../api/client';

export interface MerchantGlobalSearchResult {
  id: string;
  type: string;
  title: string;
  code: string;
  image?: string;
  sku?: string;
  url: string;
}

interface MerchantGlobalSearchResponse {
  success: true;
  results: MerchantGlobalSearchResult[];
}

interface MerchantGlobalSearchProps {
  placeholder: string;
  className?: string;
  inputClassName?: string;
  dark?: boolean;
  onSelect: (result: MerchantGlobalSearchResult) => void;
}

export function MerchantGlobalSearch({
  placeholder,
  className = '',
  inputClassName = '',
  dark = false,
  onSelect
}: MerchantGlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MerchantGlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const id = useId();
  const resultsId = `merchant-global-search-results-${id}`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => () => {
    window.clearTimeout((wrapperRef.current as HTMLDivElement & { searchTimer?: number })?.searchTimer);
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target)) {
        setOpen(false);
        abortRef.current?.abort();
        requestIdRef.current += 1;
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer);
  }, [open]);

  const search = (value: string) => {
    const nextQuery = value.trim();
    window.clearTimeout((wrapperRef.current as HTMLDivElement & { searchTimer?: number })?.searchTimer);
    abortRef.current?.abort();
    const requestId = ++requestIdRef.current;
    setResults([]);
    setError('');
    setActiveIndex(0);
    if (!nextQuery) {
      setOpen(false);
      setLoading(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    const timer = window.setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      void apiRequest<MerchantGlobalSearchResponse>(
        `/api/merchant/search?q=${encodeURIComponent(nextQuery)}`,
        { signal: controller.signal }
      ).then(response => {
        if (requestId !== requestIdRef.current) return;
        setResults(response.results.slice(0, 30));
        setLoading(false);
      }).catch(reason => {
        if (requestId !== requestIdRef.current || controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : '搜索暂时不可用，请重试。');
        setLoading(false);
      });
    }, 200);
    if (wrapperRef.current) {
      (wrapperRef.current as HTMLDivElement & { searchTimer?: number }).searchTimer = timer;
    }
  };

  const selectResult = (result: MerchantGlobalSearchResult) => {
    window.clearTimeout((wrapperRef.current as HTMLDivElement & { searchTimer?: number })?.searchTimer);
    abortRef.current?.abort();
    requestIdRef.current += 1;
    setOpen(false);
    setQuery('');
    setResults([]);
    setLoading(false);
    onSelect(result);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      abortRef.current?.abort();
      return;
    }
    if (!open || !results.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(index => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectResult(results[activeIndex] || results[0]);
    }
  };

  const panelClass = dark
    ? 'border-white/10 bg-neutral-900 text-white'
    : 'border-neutral-200 bg-white text-neutral-900';

  return (
    <div ref={wrapperRef} className={`relative min-w-0 ${className}`}>
      <Search className={`pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 ${dark ? 'text-neutral-400' : 'text-neutral-500'}`} />
      <input
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={resultsId}
        value={query}
        onChange={event => {
          setQuery(event.target.value);
          search(event.target.value);
        }}
        onFocus={() => { if (query.trim()) setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full pl-9 pr-3 outline-none ${inputClassName}`}
      />
      {open && (
        <div
          id={resultsId}
          role="listbox"
          className={`absolute left-0 right-0 top-[calc(100%+0.45rem)] z-[80] max-h-64 overflow-y-auto rounded-xl border py-1 shadow-xl ${panelClass}`}
        >
          {loading ? (
            <p className="px-3 py-3 text-xs text-neutral-500">正在查找…</p>
          ) : error ? (
            <p role="alert" className="px-3 py-3 text-xs text-rose-600">{error}</p>
          ) : results.length ? results.map((result, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              key={`${result.type}:${result.id}:${result.sku || ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectResult(result)}
              className={`flex min-h-12 w-full items-center gap-2.5 px-3 py-2 text-left ${index === activeIndex ? (dark ? 'bg-white/10' : 'bg-neutral-50') : ''}`}
            >
              {result.image
                ? <img src={result.image} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded-md bg-neutral-100 object-cover" />
                : <span className="h-8 w-8 shrink-0 rounded-md bg-neutral-100" aria-hidden="true" />}
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-xs font-semibold ${dark ? 'text-white' : 'text-neutral-900'}`}>{result.title}</span>
                <span className="mt-0.5 block truncate text-[10px] text-neutral-500">{result.code}</span>
              </span>
            </button>
          )) : (
            <p className="px-3 py-3 text-xs text-neutral-500">没有匹配结果</p>
          )}
        </div>
      )}
    </div>
  );
}
