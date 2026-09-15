import type React from 'react';
import { useState } from 'react';
import {
  ShoppingBag,
  ShieldCheck,
  Search,
  Filter,
  Truck,
  CheckCircle2,
  FileCheck,
  AlertCircle,
  ExternalLink,
  X,
  Upload,
  Building,
  Plus,
} from 'lucide-react';
import { MarketplaceItem, CompanyVerificationRequest } from '../types';

interface MarketplaceProps {
  items: MarketplaceItem[];
  onRequestVerification: (req: CompanyVerificationRequest) => void;
  onSelectPartDetail?: (partNumber: string) => void;
}

export default function Marketplace({
  items,
  onRequestVerification,
  onSelectPartDetail,
}: MarketplaceProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [verifiedTraderModal, setVerifiedTraderModal] = useState<MarketplaceItem['seller'] | null>(null);
  const [showApplyModal, setShowApplyModal] = useState<boolean>(false);
  const [purchaseSuccessItem, setPurchaseSuccessItem] = useState<string | null>(null);

  // Application form state
  const [companyName, setCompanyName] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [country, setCountry] = useState('United States');
  const [vatTax, setVatTax] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [docName, setDocName] = useState('Trading_License_Certificate.pdf');
  const [isApplying, setIsApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  const categories = [
    'All',
    'Gaming Consoles',
    'Smartphones',
    'Test & Bench Equipment',
    'Soldering Consumables',
  ];

  const filteredItems = items.filter((item) => {
    if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchSku = item.partNumberOrSku.toLowerCase().includes(q);
      const matchSeller = item.seller.name.toLowerCase().includes(q);
      if (!matchTitle && !matchSku && !matchSeller) return false;
    }
    return true;
  });

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsApplying(true);
    setTimeout(() => {
      const newReq: CompanyVerificationRequest = {
        id: `verif_${Date.now()}`,
        companyName,
        registrationNumber: regNumber,
        countryOfRegistration: country,
        tradingLicenseDocument: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80',
        vatTaxNumber: vatTax,
        contactEmail,
        contactPhone: '+1 (555) 902-1294',
        officialAddress: 'Commercial Trade District, Suite 400',
        status: 'Pending Review',
        submittedDate: new Date().toISOString().split('T')[0],
        reviewerNotes: `Submitted official trading papers via seller portal. Document: ${docName}`,
      };
      onRequestVerification(newReq);
      setIsApplying(false);
      setApplySuccess(true);
      setTimeout(() => {
        setApplySuccess(false);
        setShowApplyModal(false);
        setCompanyName('');
        setRegNumber('');
      }, 1500);
    }, 800);
  };

  const handleBuy = (item: MarketplaceItem) => {
    setPurchaseSuccessItem(item.id);
    setTimeout(() => setPurchaseSuccessItem(null), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 text-xs font-bold">
            <ShoppingBag className="w-3.5 h-3.5 text-amber-500" />
            <span>Authenticated Electronics Exchange</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
            Spare Parts & Refurbished Gear Marketplace
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">
            Source original service packs, tested motherboards, and calibrated bench equipment. Suppliers marked with the Verified Badge have passed strict business trading paper audits.
          </p>
        </div>

        {/* Verified Company Application CTA */}
        <div className="p-5 rounded-2xl bg-amber-400 text-stone-950 flex flex-col justify-between shadow-md max-w-xs space-y-3 shrink-0">
          <div>
            <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Are You an Electronics Trading Company?</span>
            </div>
            <p className="text-xs font-medium mt-1">
              Submit registered trading papers & business certificates to earn the Golden Verified Badge.
            </p>
          </div>
          <button
            onClick={() => setShowApplyModal(true)}
            className="py-2 px-3 rounded-xl bg-stone-950 text-amber-400 font-bold text-xs hover:bg-stone-900 transition-colors self-start shadow-xs flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Apply for Verified Badge</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
        
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search marketplace listings, part number or seller name..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        {/* Categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-amber-400 text-stone-950 shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Marketplace Listings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {filteredItems.map((item) => {
          const isPurchased = purchaseSuccessItem === item.id;

          return (
            <div
              key={item.id}
              className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* Image */}
                <div className="relative aspect-video w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
                  <img
                    src={item.images[0]}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    <span className="px-2.5 py-1 rounded-lg bg-stone-950/90 text-amber-400 font-bold text-[10px] tracking-wider uppercase backdrop-blur-xs">
                      {item.condition}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] tracking-wider uppercase">
                      {item.warrantyDays}d Warranty
                    </span>
                  </div>

                  <span className="absolute bottom-3 right-3 text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-stone-950/80 text-white backdrop-blur-xs">
                    In Stock: {item.stockQty} units
                  </span>
                </div>

                {/* Content */}
                <div className="p-6 space-y-3">
                  <div className="text-[11px] font-mono text-stone-400">
                    SKU: {item.partNumberOrSku}
                  </div>

                  <h3 className="text-base font-black text-stone-900 dark:text-stone-100 leading-snug">
                    {item.title}
                  </h3>

                  <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Verified Seller Box with Certificate Inspector */}
                  <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-stone-800 dark:text-stone-200 text-xs">
                          {item.seller.name}
                        </span>
                        {item.seller.isVerifiedCompany && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                            <ShieldCheck className="w-3.5 h-3.5 fill-current" />
                            <span>Verified Company</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-400 block mt-0.5">
                        {item.seller.totalSales.toLocaleString()} sales • {item.seller.rating} ★ ({item.seller.country})
                      </span>
                    </div>

                    {item.seller.isVerifiedCompany && (
                      <button
                        onClick={() => setVerifiedTraderModal(item.seller)}
                        className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 shrink-0 ml-2"
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Inspect License</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Price & Checkout Footer */}
              <div className="p-6 pt-0 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-stone-400 block">Unit Price</span>
                  <span className="text-xl font-black font-mono text-stone-900 dark:text-stone-100">
                    ${item.priceUSD.toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={() => handleBuy(item)}
                  disabled={isPurchased}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-xs flex items-center gap-1.5 ${
                    isPurchased
                      ? 'bg-emerald-500 text-white'
                      : 'bg-amber-400 hover:bg-amber-300 text-stone-950'
                  }`}
                >
                  {isPurchased ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Order Placed!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>Order Component</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Verified Trader Registration Papers Modal */}
      {verifiedTraderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 sm:p-8 space-y-6 shadow-2xl">
            <button
              onClick={() => setVerifiedTraderModal(null)}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-400 text-stone-950 flex items-center justify-center shadow-md">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                  Verified Legal Entity
                </span>
                <h3 className="text-lg font-black text-stone-900 dark:text-stone-100">
                  {verifiedTraderModal.name}
                </h3>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800 space-y-3 text-xs">
              <div className="flex justify-between pb-2 border-b border-stone-200 dark:border-stone-700">
                <span className="text-stone-500">Jurisdiction</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">{verifiedTraderModal.country}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-stone-200 dark:border-stone-700">
                <span className="text-stone-500">Official Company Reg. #</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  {verifiedTraderModal.companyRegistrationNumber || 'REG-4920491'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-stone-500 block">Certificate of Good Standing & Trading License:</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200 block">
                  {verifiedTraderModal.tradingCertificateName || 'National Registered Commercial Entity Certification'}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-stone-500">Audit Status</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Authenticated & Insured</span>
                </span>
              </div>
            </div>

            <div className="text-[11px] text-stone-500 leading-relaxed">
              This business has filed authentic government trading registration certificates. All component shipments are backed by DIYELECTRONICS 100% genuine silicon anti-counterfeit guarantee.
            </div>

            <button
              onClick={() => setVerifiedTraderModal(null)}
              className="w-full py-2.5 rounded-xl bg-stone-950 text-white dark:bg-amber-400 dark:text-stone-950 font-bold text-xs"
            >
              Close Verification Audit
            </button>
          </div>
        </div>
      )}

      {/* Apply for Verified Trader Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 sm:p-8 space-y-5 shadow-2xl">
            <button
              onClick={() => setShowApplyModal(false)}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-stone-900 dark:text-stone-100">
                Company Trading Papers Verification
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Submit your registered commercial license to earn the golden verified company badge and list spare parts on the marketplace.
              </p>
            </div>

            {applySuccess ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
                <h4 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Trading Papers Submitted for Audit!
                </h4>
                <p className="text-xs text-stone-500">
                  Our compliance team has received your registration documents and queued them in the Admin Desk.
                </p>
              </div>
            ) : (
              <form onSubmit={handleApplySubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Registered Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Apex Silicon Spares International Ltd"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      Business Reg / License # *
                    </label>
                    <input
                      type="text"
                      required
                      value={regNumber}
                      onChange={(e) => setRegNumber(e.target.value)}
                      placeholder="e.g. CN-SZ-91440300"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      Country of Trade *
                    </label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                    >
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Netherlands">Netherlands</option>
                      <option value="Germany">Germany</option>
                      <option value="China">China</option>
                      <option value="Japan">Japan</option>
                      <option value="Singapore">Singapore</option>
                      <option value="Other">Other Global</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    VAT / Tax Identification Number
                  </label>
                  <input
                    type="text"
                    value={vatTax}
                    onChange={(e) => setVatTax(e.target.value)}
                    placeholder="e.g. GB 928 4103 22 or EIN"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Compliance Contact Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="compliance@yourcompany.com"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                  />
                </div>

                {/* File Upload Simulated */}
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Attach Registered Trading License Document (PDF / JPEG) *
                  </label>
                  <div className="p-3 border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-xl bg-stone-50 dark:bg-stone-800/40 text-center space-y-1">
                    <Upload className="w-5 h-5 mx-auto text-amber-500" />
                    <span className="font-bold text-stone-700 dark:text-stone-300 block">{docName}</span>
                    <span className="text-[10px] text-stone-400 block">Certificate of Incorporation & Trade Registry</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isApplying}
                  className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs transition-colors shadow-xs"
                >
                  {isApplying ? 'Uploading & Filing Registration...' : 'Submit Trading Papers for Review'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
