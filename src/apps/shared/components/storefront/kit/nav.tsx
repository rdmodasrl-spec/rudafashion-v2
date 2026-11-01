/**
 * 店铺模板构件：五种导航模型。
 *
 * 导航是「网站结构」最直观的差异，因此不做成同一套皮肤：
 * - EditorialNav：品牌居中 + 细链接，搜索收进图标（品牌官网）
 * - UtilityNav：工具条，搜索与分类内联，购物车/询价前置（专业目录、贸易）
 * - MegaNav：多级分类面板（百货批发）
 * - FloorNav：楼层/品牌标签 + 吸顶分类条（连锁百货、综合零售）
 * - FactoryNav：深色能力导航 + 打样/询价 CTA（生产型）
 */
import React, { useState } from 'react';
import { ChevronDown, Menu, Phone, Search, ShoppingCart, X } from 'lucide-react';

export type NavCategory = { value: string; label: string; count: number };

const Wordmark: React.FC<{ name: string; dark?: boolean }> = ({ name, dark = false }) => (
  <span className={`text-sm font-semibold uppercase tracking-[0.28em] ${dark ? 'text-white' : 'text-neutral-900'}`}>{name}</span>
);

export const EditorialNav: React.FC<{
  name: string;
  links?: string[];
  query: string;
  onQuery: (value: string) => void;
  onContact?: () => void;
  cartCount: number;
}> = ({ name, links = ['系列', '工艺', '品牌', '联系'], query, onQuery, onContact, cartCount }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-auto max-w-[1400px] px-5">
      <div className="flex h-16 items-center justify-between gap-4">
        <nav className="hidden flex-1 items-center gap-6 text-xs uppercase tracking-[0.18em] text-neutral-600 lg:flex">
          {links.slice(0, 2).map(link => (
            <a key={link} href={`#${link}`} className="transition-colors hover:text-neutral-900">{link}</a>
          ))}
        </nav>
        <Wordmark name={name} />
        <div className="flex flex-1 items-center justify-end gap-4 text-xs uppercase tracking-[0.18em] text-neutral-600">
          <button type="button" onClick={() => setOpen(value => !value)} className="hidden transition-colors hover:text-neutral-900 lg:block" aria-expanded={open}>
            搜索
          </button>
          {links.slice(2).map(link => (
            <a key={link} href={`#${link}`} className="hidden transition-colors hover:text-neutral-900 lg:block">{link}</a>
          ))}
          <button type="button" onClick={onContact} className="hidden border border-neutral-900 px-3 py-1.5 text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white lg:block">
            联系
          </button>
          <button type="button" onClick={() => setOpen(value => !value)} className="lg:hidden" aria-label="搜索">
            <Search className="h-4 w-4" />
          </button>
          <span className="flex items-center gap-1 text-neutral-900"><ShoppingCart className="h-4 w-4" />{cartCount}</span>
        </div>
      </div>
      {open ? (
        <div className="border-t border-neutral-200 py-3">
          <input
            autoFocus
            value={query}
            onChange={event => onQuery(event.target.value)}
            placeholder="搜索款式、款号或材质"
            className="w-full border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-neutral-900"
          />
        </div>
      ) : null}
    </div>
  );
};

export const UtilityNav: React.FC<{
  name: string;
  categories: NavCategory[];
  category: string;
  onCategory: (value: string) => void;
  query: string;
  onQuery: (value: string) => void;
  cartCount: number;
  onCart?: () => void;
  onContact?: () => void;
}> = ({ name, categories, category, onCategory, query, onQuery, cartCount, onCart, onContact }) => (
  <div className="mx-auto max-w-[1400px] px-4">
    <div className="flex h-14 items-center gap-3">
      <p className="shrink-0 text-sm font-semibold tracking-tight text-neutral-900">{name}</p>
      <div className="relative min-w-0 flex-1">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
        <input
          value={query}
          onChange={event => onQuery(event.target.value)}
          placeholder="款号 / 品名 / 材质"
          className="h-9 w-full border border-neutral-300 bg-white pl-8 pr-3 text-xs outline-none focus:border-neutral-900"
        />
      </div>
      <select
        value={category}
        onChange={event => onCategory(event.target.value)}
        aria-label="商品分类"
        className="hidden h-9 border border-neutral-300 bg-white px-2 text-xs sm:block"
      >
        <option value="all">全部分类</option>
        {categories.map(item => <option key={item.value} value={item.value}>{item.label}（{item.count}）</option>)}
      </select>
      <button type="button" onClick={onCart} className="flex h-9 items-center gap-1.5 border border-neutral-900 px-2.5 text-xs font-semibold text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white">
        <ShoppingCart className="h-3.5 w-3.5" />订货车 {cartCount}
      </button>
      <button type="button" onClick={onContact} className="hidden h-9 items-center border border-neutral-300 px-2.5 text-xs text-neutral-700 transition-colors hover:border-neutral-900 lg:flex">
        询价
      </button>
    </div>
  </div>
);

export const MegaNav: React.FC<{
  name: string;
  categories: NavCategory[];
  category: string;
  onCategory: (value: string) => void;
  query: string;
  onQuery: (value: string) => void;
}> = ({ name, categories, category, onCategory, query, onQuery }) => {
  const [open, setOpen] = useState(false);
  const total = categories.reduce((sum, item) => sum + item.count, 0);
  return (
    <div className="mx-auto max-w-[1400px] px-4">
      <div className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setOpen(value => !value)} className="flex items-center gap-2 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white" aria-expanded={open}>
            {open ? <X className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}
            全部类目
          </button>
          <p className="text-sm font-semibold tracking-tight text-neutral-900">{name}</p>
          <span className="hidden text-xs text-neutral-500 sm:inline">共 {total} 款在售</span>
        </div>
        <div className="relative w-40 shrink-0 sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={event => onQuery(event.target.value)}
            placeholder="全站搜索"
            className="h-9 w-full border border-neutral-300 bg-white pl-8 pr-3 text-xs outline-none focus:border-neutral-900"
          />
        </div>
      </div>
      {open ? (
        <div className="grid gap-x-6 gap-y-1 border-t border-neutral-200 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <button type="button" onClick={() => { onCategory('all'); setOpen(false); }} className={`text-left text-xs ${category === 'all' ? 'font-semibold text-neutral-900' : 'text-neutral-600'}`}>
            全部商品（{total}）
          </button>
          {categories.map(item => (
            <button
              key={item.value}
              type="button"
              onClick={() => { onCategory(item.value); setOpen(false); }}
              className={`text-left text-xs ${category === item.value ? 'font-semibold text-neutral-900' : 'text-neutral-600 hover:text-neutral-900'}`}
            >
              {item.label}（{item.count}）
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto border-t border-neutral-200 py-2 text-xs text-neutral-600">
          <button type="button" onClick={() => onCategory('all')} className={category === 'all' ? 'font-semibold text-neutral-900' : ''}>全部</button>
          {categories.slice(0, 10).map(item => (
            <button key={item.value} type="button" onClick={() => onCategory(item.value)} className={`shrink-0 ${category === item.value ? 'font-semibold text-neutral-900' : ''}`}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const FloorNav: React.FC<{
  name: string;
  floors: string[];
  floor: string;
  onFloor: (value: string) => void;
  categories: NavCategory[];
  category: string;
  onCategory: (value: string) => void;
  cartCount: number;
}> = ({ name, floors, floor, onFloor, categories, category, onCategory, cartCount }) => (
  <div className="mx-auto max-w-[1400px] px-4">
    <div className="flex h-12 items-center gap-4 text-xs">
      <p className="shrink-0 text-sm font-semibold tracking-tight text-neutral-900">{name}</p>
      <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto">
        {floors.map(item => (
          <button
            key={item}
            type="button"
            onClick={() => onFloor(item)}
            className={`shrink-0 border-b-2 px-1 py-1 transition-colors ${floor === item ? 'border-neutral-900 font-semibold text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900'}`}
          >
            {item}
          </button>
        ))}
      </div>
      <span className="flex shrink-0 items-center gap-1 text-neutral-700"><ShoppingCart className="h-3.5 w-3.5" />{cartCount}</span>
    </div>
    <div className="flex gap-4 overflow-x-auto border-t border-neutral-200 py-2 text-xs text-neutral-600">
      <button type="button" onClick={() => onCategory('all')} className={category === 'all' ? 'shrink-0 font-semibold text-neutral-900' : 'shrink-0'}>全部品类</button>
      {categories.slice(0, 12).map(item => (
        <button key={item.value} type="button" onClick={() => onCategory(item.value)} className={`shrink-0 ${category === item.value ? 'font-semibold text-neutral-900' : ''}`}>
          {item.label}
        </button>
      ))}
    </div>
  </div>
);

export const FactoryNav: React.FC<{
  name: string;
  links?: string[];
  onInquiry: () => void;
  onContact?: () => void;
}> = ({ name, links = ['产能', '工艺', '认证', '案例'], onInquiry, onContact }) => (
  <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-5">
    <Wordmark name={name} dark />
    <nav className="hidden items-center gap-6 text-xs uppercase tracking-[0.16em] text-neutral-400 lg:flex">
      {links.map(link => <a key={link} href={`#${link}`} className="transition-colors hover:text-white">{link}</a>)}
    </nav>
    <div className="flex items-center gap-2">
      <button type="button" onClick={onContact} className="hidden items-center gap-1.5 border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:border-neutral-400 lg:flex">
        <Phone className="h-3.5 w-3.5" />联系
      </button>
      <button type="button" onClick={onInquiry} className="flex items-center gap-1.5 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-950 transition-colors hover:bg-neutral-200">
        发起询价<ChevronDown className="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
);
