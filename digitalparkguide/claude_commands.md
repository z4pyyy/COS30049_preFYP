## Public Announcements page
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Public Announcements | Digital Sentinel</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&amp;family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "on-tertiary-fixed-variant": "#930007",
                        "primary": "#012d1d",
                        "on-surface": "#191c1d",
                        "surface-bright": "#f8f9fa",
                        "surface": "#f8f9fa",
                        "surface-container-highest": "#e1e3e4",
                        "inverse-on-surface": "#f0f1f2",
                        "on-secondary-container": "#526772",
                        "error-container": "#ffdad6",
                        "on-primary-container": "#86af99",
                        "tertiary-fixed-dim": "#ffb4aa",
                        "secondary-fixed-dim": "#b4cad6",
                        "on-surface-variant": "#414844",
                        "tertiary-fixed": "#ffdad5",
                        "on-secondary-fixed": "#071e27",
                        "on-primary-fixed": "#002114",
                        "surface-variant": "#e1e3e4",
                        "on-tertiary-fixed": "#410001",
                        "surface-container": "#edeeef",
                        "on-error": "#ffffff",
                        "error": "#ba1a1a",
                        "inverse-primary": "#a5d0b9",
                        "on-primary-fixed-variant": "#274e3d",
                        "surface-tint": "#3f6653",
                        "primary-container": "#1b4332",
                        "outline": "#717973",
                        "inverse-surface": "#2e3132",
                        "on-error-container": "#93000a",
                        "outline-variant": "#c1c8c2",
                        "on-secondary": "#ffffff",
                        "tertiary-container": "#7e0005",
                        "on-tertiary": "#ffffff",
                        "background": "#f8f9fa",
                        "secondary-fixed": "#cfe6f2",
                        "surface-container-lowest": "#ffffff",
                        "on-primary": "#ffffff",
                        "surface-container-low": "#f3f4f5",
                        "on-secondary-fixed-variant": "#354a53",
                        "primary-fixed-dim": "#a5d0b9",
                        "surface-container-high": "#e7e8e9",
                        "tertiary": "#550002",
                        "on-tertiary-container": "#ff8172",
                        "secondary-container": "#cfe6f2",
                        "primary-fixed": "#c1ecd4",
                        "secondary": "#4c616c",
                        "on-background": "#191c1d",
                        "surface-dim": "#d9dadb"
                    },
                    fontFamily: {
                        "headline": ["Inter"],
                        "body": ["Inter"],
                        "label": ["Inter"]
                    },
                    borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},
                },
            },
        }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .sentinel-overlay {
            background: linear-gradient(rgba(1, 45, 29, 0.2), rgba(1, 45, 29, 0.2)), url('https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80');
            background-size: cover;
            background-position: center;
        }
    </style>
</head>
<body class="bg-surface font-body text-on-surface antialiased">
<!-- Top Navigation Bar -->
<nav class="bg-emerald-950/90 backdrop-blur-xl dark:bg-slate-950/90 docked full-width top-0 sticky z-50 shadow-[0_20px_40px_rgba(25,28,29,0.06)] px-6 py-4 flex justify-between items-center w-full">
<div class="flex items-center gap-8">
<span class="text-xl font-bold tracking-tighter text-white">Digital Sentinel</span>
<div class="hidden md:flex gap-6 items-center">
<a class="font-['Inter'] tracking-tight text-emerald-100/70 hover:text-white transition-colors" href="#">Training</a>
<a class="font-['Inter'] tracking-tight text-emerald-100/70 hover:text-white transition-colors" href="#">Programmes</a>
<a class="font-['Inter'] tracking-tight text-emerald-100/70 hover:text-white transition-colors" href="#">Dashboard</a>
</div>
</div>
<div class="flex items-center gap-4">
<div class="relative hidden sm:block">
<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-sm">search</span>
<input class="bg-white/10 border-none text-white text-sm rounded-full pl-10 pr-4 py-2 w-64 focus:ring-2 focus:ring-white/20 transition-all placeholder:text-white/40" placeholder="Search system..." type="text"/>
</div>
<button class="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full transition-all text-sm font-medium active:scale-95">
<span class="material-symbols-outlined text-[18px]">login</span>
                Sign In
            </button>
</div>
</nav>
<main class="min-h-screen">
<!-- Hero Section -->
<header class="relative h-[450px] flex items-end overflow-hidden bg-primary px-6 md:px-12 pb-16">
<div class="absolute inset-0 sentinel-overlay opacity-60" data-alt="Dense Sarawak rainforest canopy viewed from below with light rays filtering through giant tropical leaves in high resolution"></div>
<div class="relative z-10 max-w-4xl">
<div class="inline-flex items-center gap-2 bg-tertiary-container/40 text-on-tertiary-container backdrop-blur-md px-3 py-1 rounded-full mb-6">
<span class="material-symbols-outlined text-[14px]">sensors</span>
<span class="text-[11px] font-bold tracking-[0.2em] uppercase">Live Broadcast Portal</span>
</div>
<h1 class="text-5xl md:text-7xl font-headline font-black text-white tracking-tighter leading-none mb-6">
                    Guardian <br/><span class="text-primary-fixed-dim">Announcements</span>
</h1>
<p class="text-emerald-50/80 text-lg max-w-xl font-light leading-relaxed">
                    Intelligence, field reports, and strategic updates from the Sarawak Biodiversity Unit. Monitoring the heartbeat of Borneo.
                </p>
</div>
<div class="absolute right-0 bottom-0 p-12 hidden lg:block">
<div class="bg-white/5 backdrop-blur-2xl p-6 rounded-xl border border-white/10 flex flex-col gap-4">
<div class="flex gap-4 items-center">
<div class="h-12 w-12 rounded-lg bg-primary-container flex items-center justify-center">
<span class="material-symbols-outlined text-white" data-weight="fill">shield_with_heart</span>
</div>
<div>
<p class="text-[10px] uppercase tracking-widest text-white/50 font-bold">Patrol Status</p>
<p class="text-white font-bold">Active Units: 142</p>
</div>
</div>
</div>
</div>
</header>
<!-- Filter Bar -->
<section class="bg-surface-container-low px-6 md:px-12 py-8 flex flex-col md:flex-row justify-between items-center gap-6">
<div class="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-4 md:pb-0 no-scrollbar">
<button class="bg-primary text-white px-6 py-2 rounded-full text-sm font-medium whitespace-nowrap">All Updates</button>
<button class="bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high px-6 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors">Field Alerts</button>
<button class="bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high px-6 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors">Training News</button>
<button class="bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high px-6 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors">Strategic Ops</button>
</div>
<div class="flex items-center gap-4 w-full md:w-auto">
<div class="flex items-center gap-2 text-secondary text-sm font-medium">
<span class="material-symbols-outlined text-[18px]">sort</span>
                    Sort by: Latest
                </div>
</div>
</section>
<!-- Announcements Grid -->
<section class="px-6 md:px-12 py-16 max-w-[1600px] mx-auto">
<div class="grid grid-cols-1 md:grid-cols-12 gap-8">
<!-- Main Featured Announcement -->
<article class="md:col-span-8 group cursor-pointer">
<div class="relative h-[500px] rounded-xl overflow-hidden mb-6">
<img alt="" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" data-alt="Close-up of a rare tropical plant with vibrant green leaves and detailed veins in a misty jungle environment" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBTSTnY437kIKUXoiWPByremRs9NAr-4nT067g1UVh35U-s1MIT5VzoO8wnAtBBeS-8ywdOEQMAJIep1KU1g3892jrHLyQ8wvfN7A_lDWb97oiVaswENWncM1RDVZ_DwHlnrUH6TfxIeHPjUBVQ7_pluj8UNJxR8AwqEyECM1YAATdYAg4WhHmPo_nWVNWOViyXvHs2eGQo67Wvdrt5eRpdA0Y3d8GpoZ5UgLWAsYFV65_uUyVBl5lgacV4H56MWaejf7s91P1U775J"/>
<div class="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/20 to-transparent"></div>
<div class="absolute bottom-0 left-0 p-8">
<span class="bg-error text-white text-[10px] font-bold tracking-[0.2em] uppercase px-3 py-1 rounded-sm mb-4 inline-block">Urgent Deployment</span>
<h2 class="text-3xl md:text-5xl font-headline font-bold text-white tracking-tight mb-4">New Sentinel AI: Predictive Poaching Prevention Module</h2>
<p class="text-emerald-50/70 text-lg max-w-2xl">The latest update to the Ranger Track includes AI-driven heatmaps predicting movement patterns in restricted zones.</p>
</div>
</div>
</article>
<!-- Sidebar Grid Items -->
<article class="md:col-span-4 bg-surface-container-lowest p-8 rounded-xl flex flex-col justify-between border-l-4 border-error">
<div>
<p class="text-[11px] font-black uppercase tracking-widest text-error mb-4">Incident Alert</p>
<h3 class="text-2xl font-bold tracking-tight mb-4 text-primary leading-tight">Live: Bako National Park Restoration Project Phase 4</h3>
<p class="text-secondary mb-6 leading-relaxed">The re-population of endemic orchid species has reached a 15% milestone in the northern quadrant.</p>
</div>
<div class="flex items-center justify-between border-t border-surface-container-high pt-6">
<span class="text-xs text-on-surface-variant font-medium">12 Oct 2023</span>
<a class="text-primary font-bold text-sm flex items-center gap-1 hover:gap-3 transition-all" href="#">Report <span class="material-symbols-outlined text-[16px]">arrow_forward</span></a>
</div>
</article>
<!-- Second Row (Asymmetric) -->
<article class="md:col-span-4 bg-surface-container-low rounded-xl overflow-hidden group">
<div class="h-48 overflow-hidden">
<img alt="" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" data-alt="Lush green mountain range in Borneo covered in thick fog at sunrise with deep emerald tones" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCSWhUO0_atSLW0douL583fkM2GSjNM48YVelqKN_pv2PUoLpIRFQDzWVC36hBFIf__7tNJW5jupqmw_rDJlvV7pHG22wTKfSwn74H3fx0469y30Y89kdb2F--vDDjc0jO4UmtyH6Z_BZ1C2D5d4WAanbOBLB2nkAu-BEgLA6-pSuFkW3oECY1IbMP2FmMSJoqNs8OZLyb8Fy51OrMtmBMe29fPeNENwkMlHNU2DJyLZOOzrevNY4W5BESYtaOhhseWBRs3CmxV7XcR"/>
</div>
<div class="p-6">
<span class="text-[10px] font-bold uppercase tracking-[0.15em] text-secondary-fixed-dim bg-secondary-container px-2 py-0.5 rounded">Training</span>
<h3 class="text-xl font-bold text-primary mt-3 mb-2 leading-tight">Guide Track: Navigation Skills Enhancement</h3>
<p class="text-on-surface-variant text-sm line-clamp-3">New modules for satellite-free navigation are now available for all Grade II Guides.</p>
</div>
</article>
<article class="md:col-span-4 bg-surface-container-low rounded-xl overflow-hidden group">
<div class="h-48 overflow-hidden">
<img alt="" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" data-alt="Top down view of a flowing river cutting through a dense dark green forest representing water systems monitoring" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCFN9DmquZczlnKCUNkb28xl9YIFKtZPXvLScKqwGZslyg0AP5HpBej1imVEePY8U-K5IA4mnnQUzfxaBL6o3nMRfEAQMU2T_hGUD94IiKsjXSuSE5yIuvey4pB0aMeZ5oik86FLSG6zyZfba5K359O2D5sIIDjojadHWn_6xm3H0fmEKNLwPdI7wseC83uOTaZCJRvSVGAF0KsaFc_1aOxKiu0Qv35Ke8G2YiUPJrnkdSZz-tYvYyGwDYcq3qthy8B2WQc8Ity1dmx"/>
</div>
<div class="p-6">
<span class="text-[10px] font-bold uppercase tracking-[0.15em] text-secondary-fixed-dim bg-secondary-container px-2 py-0.5 rounded">Ecology</span>
<h3 class="text-xl font-bold text-primary mt-3 mb-2 leading-tight">Hydrology Patterns: Annual Sarawak River Survey</h3>
<p class="text-on-surface-variant text-sm line-clamp-3">Comprehensive data regarding siltation levels and water health in key tributaries.</p>
</div>
</article>
<article class="md:col-span-4 bg-primary text-white rounded-xl p-8 relative flex flex-col justify-center">
<div class="absolute top-0 right-0 p-4 opacity-10">
<span class="material-symbols-outlined text-[100px]" data-weight="fill">shield</span>
</div>
<h3 class="text-2xl font-bold mb-4 relative z-10">Institutional Links</h3>
<p class="text-emerald-100/60 text-sm mb-6 relative z-10">Access restricted government documentation and multi-agency cooperation frameworks.</p>
<button class="bg-white text-primary px-6 py-2 rounded-full font-bold text-sm w-fit active:scale-95 transition-transform relative z-10">Explore Archive</button>
</article>
</div>
</section>
<!-- Newsletter / CTA -->
<section class="bg-white py-20 px-6">
<div class="max-w-4xl mx-auto text-center">
<span class="material-symbols-outlined text-error text-[48px] mb-4">mail</span>
<h2 class="text-3xl font-headline font-black text-primary tracking-tight mb-4">Stay Synchronized</h2>
<p class="text-secondary max-w-lg mx-auto mb-10">Subscribe to the Digital Sentinel Briefing for monthly intelligence on Sarawak's biodiversity progress.</p>
<form class="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
<input class="flex-1 bg-surface-container border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" placeholder="official@agency.gov" type="email"/>
<button class="bg-primary text-white font-bold px-8 py-3 rounded-xl hover:bg-primary/90 transition-colors active:scale-95" type="submit">Subscribe</button>
</form>
</div>
</section>
</main>
<!-- Footer -->
<footer class="bg-emerald-950 dark:bg-black w-full py-12 mt-auto">
<div class="flex flex-col md:flex-row justify-between items-center px-12 gap-8">
<div class="flex flex-col gap-2">
<span class="text-sm font-bold text-white">Digital Sentinel</span>
<p class="font-['Inter'] text-xs font-light tracking-wide text-emerald-100/50 max-w-[240px]">
                    Official training and announcement portal for the Sarawak Forestry Corporation Biodiversity Unit.
                </p>
</div>
<div class="flex flex-wrap justify-center gap-8">
<a class="font-['Inter'] text-xs font-light tracking-wide text-emerald-100 opacity-70 hover:opacity-100 hover:text-red-500 transition-colors" href="#">Accessibility</a>
<a class="font-['Inter'] text-xs font-light tracking-wide text-emerald-100 opacity-70 hover:opacity-100 hover:text-red-500 transition-colors" href="#">Privacy Policy</a>
<a class="font-['Inter'] text-xs font-light tracking-wide text-emerald-100 opacity-70 hover:opacity-100 hover:text-red-500 transition-colors" href="#">Institutional Links</a>
<a class="font-['Inter'] text-xs font-light tracking-wide text-emerald-100 opacity-70 hover:opacity-100 hover:text-red-500 transition-colors" href="#">Contact Sentinel</a>
</div>
<div class="text-right">
<p class="font-['Inter'] text-xs font-light tracking-wide text-emerald-100 opacity-50">© 2024 Sarawak Forestry Corporation. All rights reserved.</p>
</div>
</div>
</footer>
</body></html>





## Sign Up page
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Sign In | Digital Sentinel</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@100;300;400;500;600;700;800;900&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "on-tertiary-fixed-variant": "#930007",
                        "primary": "#012d1d",
                        "on-surface": "#191c1d",
                        "surface-bright": "#f8f9fa",
                        "surface": "#f8f9fa",
                        "surface-container-highest": "#e1e3e4",
                        "inverse-on-surface": "#f0f1f2",
                        "on-secondary-container": "#526772",
                        "error-container": "#ffdad6",
                        "on-primary-container": "#86af99",
                        "tertiary-fixed-dim": "#ffb4aa",
                        "secondary-fixed-dim": "#b4cad6",
                        "on-surface-variant": "#414844",
                        "tertiary-fixed": "#ffdad5",
                        "on-secondary-fixed": "#071e27",
                        "on-primary-fixed": "#002114",
                        "surface-variant": "#e1e3e4",
                        "on-tertiary-fixed": "#410001",
                        "surface-container": "#edeeef",
                        "on-error": "#ffffff",
                        "error": "#ba1a1a",
                        "inverse-primary": "#a5d0b9",
                        "on-primary-fixed-variant": "#274e3d",
                        "surface-tint": "#3f6653",
                        "primary-container": "#1b4332",
                        "outline": "#717973",
                        "inverse-surface": "#2e3132",
                        "on-error-container": "#93000a",
                        "outline-variant": "#c1c8c2",
                        "on-secondary": "#ffffff",
                        "tertiary-container": "#7e0005",
                        "on-tertiary": "#ffffff",
                        "background": "#f8f9fa",
                        "secondary-fixed": "#cfe6f2",
                        "surface-container-lowest": "#ffffff",
                        "on-primary": "#ffffff",
                        "surface-container-low": "#f3f4f5",
                        "on-secondary-fixed-variant": "#354a53",
                        "primary-fixed-dim": "#a5d0b9",
                        "surface-container-high": "#e7e8e9",
                        "tertiary": "#550002",
                        "on-tertiary-container": "#ff8172",
                        "secondary-container": "#cfe6f2",
                        "primary-fixed": "#c1ecd4",
                        "secondary": "#4c616c",
                        "on-background": "#191c1d",
                        "surface-dim": "#d9dadb"
                    },
                    fontFamily: {
                        "headline": ["Inter"],
                        "body": ["Inter"],
                        "label": ["Inter"]
                    },
                    borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},
                },
            },
        }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .sentinel-overlay {
            background-blend-mode: color-burn;
            background-color: rgba(1, 45, 29, 0.2);
        }
        .glass-panel {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(20px);
        }
    </style>
</head>
<body class="bg-surface font-body text-on-surface min-h-screen flex flex-col">
<!-- Top Navigation Suppression: Not rendered per the "Destination" Rule for Transactional flow -->
<main class="flex-grow flex flex-col md:flex-row relative overflow-hidden">
<!-- Left Side: Visual Sentinel -->
<section class="hidden md:flex md:w-1/2 lg:w-3/5 relative bg-primary items-end p-12 overflow-hidden">
<div class="absolute inset-0 z-0">
<img class="w-full h-full object-cover sentinel-overlay opacity-60" data-alt="cinematic wide shot of a dense tropical rainforest canopy with morning mist and soft sunbeams piercing through the foliage" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBxihwvVjibhB_LAFKiGBWdeoDgg2qXXy1x_zFdLb-nVQ-RzHSm7KR6PUCkYvLHN4iwDdI8hTw3CgGuqr1gUgWTvQ1qRYJyVAnBYRhUB7xoU2UEDUBMteNhcx8gKPEStF0ymmC1e-sfkIcz7DOmwic5LVqPHf1MP4caLXwt_jv9BNxgDcvlXV1h1HzZ4HZdHFfV_xmBdZIIPuQMUjXkd31_QRtX9vFoDmWJTxg8ByJWVk-AP_Nf3VgZYl7f5YpkF2Z2c7nU-l-95Bxw"/>
</div>
<div class="relative z-10 space-y-6 max-w-xl">
<div class="flex items-center gap-3">
<div class="w-12 h-1 bg-tertiary-container"></div>
<span class="font-label text-xs uppercase tracking-widest text-on-primary-container">Biodiversity Unit</span>
</div>
<h1 class="font-headline text-5xl lg:text-7xl font-extrabold text-white tracking-tighter leading-none">
                    Guardian <br/>Portal
                </h1>
<p class="text-white/80 text-lg leading-relaxed max-w-md">
                    Secure access for the Sarawak Forestry Corporation personnel. Monitoring, training, and incident management in the heart of Borneo.
                </p>
<!-- Digital Pips Decoration -->
<div class="flex gap-4 pt-4">
<div class="flex flex-col gap-1">
<span class="text-[10px] text-white/40 font-mono">COORD_01</span>
<div class="h-1 w-8 bg-white/20"></div>
</div>
<div class="flex flex-col gap-1">
<span class="text-[10px] text-white/40 font-mono">DATA_STREAM</span>
<div class="h-1 w-12 bg-white/40"></div>
</div>
<div class="flex flex-col gap-1">
<span class="text-[10px] text-white/40 font-mono">SENTINEL_ACTIVE</span>
<div class="h-1 w-16 bg-tertiary-container"></div>
</div>
</div>
</div>
<!-- Asymmetrical Overlay Element -->
<div class="absolute -right-20 top-1/4 w-64 h-64 border border-white/10 rounded-full flex items-center justify-center">
<div class="w-48 h-48 border border-white/5 rounded-full"></div>
</div>
</section>
<!-- Right Side: Authentication Form -->
<section class="w-full md:w-1/2 lg:w-2/5 flex items-center justify-center p-6 md:p-12 lg:p-24 bg-surface">
<div class="w-full max-w-md space-y-10">
<!-- Brand Header -->
<div class="space-y-2">
<div class="flex items-center gap-2 mb-8">
<span class="material-symbols-outlined text-primary text-3xl" data-weight="fill">shield_person</span>
<span class="text-xl font-bold tracking-tighter text-primary">Digital Sentinel</span>
</div>
<h2 class="font-headline text-3xl font-bold text-on-surface tracking-tight">Identity Verification</h2>
<p class="text-on-surface-variant">Access the centralized training ecosystem.</p>
</div>
<!-- Auth Flows -->
<div class="space-y-6">
<!-- Google OAuth -->
<button class="w-full flex items-center justify-center gap-3 bg-surface-container-lowest text-on-surface py-4 px-6 rounded-xl shadow-[0_20px_40px_rgba(25,28,29,0.06)] hover:bg-surface-container transition-all group border border-outline-variant/10">
<svg class="w-5 h-5" viewbox="0 0 24 24">
<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
</svg>
<span class="font-medium">Sign in with Google</span>
</button>
<div class="flex items-center gap-4 py-2">
<div class="h-px flex-grow bg-outline-variant/30"></div>
<span class="text-xs uppercase tracking-widest text-outline font-semibold">Or OTP</span>
<div class="h-px flex-grow bg-outline-variant/30"></div>
</div>
<!-- OTP Flow -->
<form class="space-y-6">
<div class="space-y-4">
<!-- Input Field -->
<div class="group">
<label class="block font-label text-xs uppercase tracking-widest text-on-surface-variant mb-2 ml-1">Work Email</label>
<div class="relative">
<input class="w-full bg-surface-container-high border-none rounded-xl py-4 px-5 focus:ring-2 focus:ring-surface-tint/20 transition-all placeholder:text-on-surface-variant/40" placeholder="ranger.name@forestry.gov.my" type="email"/>
</div>
</div>
<!-- OTP Input UI (Active State Demo) -->
<div class="pt-2">
<label class="block font-label text-xs uppercase tracking-widest text-on-surface-variant mb-2 ml-1">Verification Code</label>
<div class="flex justify-between gap-3">
<input class="w-full h-14 text-center text-xl font-bold bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-surface-tint/20" maxlength="1" type="text"/>
<input class="w-full h-14 text-center text-xl font-bold bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-surface-tint/20" maxlength="1" type="text"/>
<input class="w-full h-14 text-center text-xl font-bold bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-surface-tint/20" maxlength="1" type="text"/>
<input class="w-full h-14 text-center text-xl font-bold bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-surface-tint/20" maxlength="1" type="text"/>
</div>
<div class="mt-3 flex justify-between items-center px-1">
<button class="text-xs font-semibold text-primary hover:underline" type="button">Resend Code</button>
<span class="text-[10px] text-on-surface-variant font-mono">01:54 remaining</span>
</div>
</div>
</div>
<!-- Error State (Hidden/Conditional) -->
<div class="flex items-center gap-3 p-4 bg-error-container/40 rounded-xl">
<span class="material-symbols-outlined text-error text-xl" data-weight="fill">error</span>
<div class="flex flex-col">
<span class="text-xs font-bold text-on-error-container">Invalid OTP</span>
<span class="text-[10px] text-on-error-container/80">The code entered is incorrect. Please try again.</span>
</div>
</div>
<!-- Primary CTA -->
<button class="w-full bg-tertiary-container text-white py-4 rounded-xl font-bold text-lg shadow-[0_10px_20px_rgba(220,46,39,0.2)] hover:scale-[1.02] active:scale-95 transition-all" type="submit">
                            Verify Identity
                        </button>
</form>
</div>
<div class="text-center">
<p class="text-sm text-on-surface-variant">
                        Trouble logging in? <a class="text-primary font-bold hover:underline" href="#">Contact Sentinel Support</a>
</p>
</div>
</div>
</section>
</main>
<!-- Footer Component Mapping from JSON -->
<footer class="w-full py-8 mt-auto bg-emerald-950 dark:bg-black flex flex-col md:flex-row justify-between items-center px-12 gap-4">
<div class="flex flex-col md:flex-row items-center gap-6">
<span class="text-sm font-bold text-white">Digital Sentinel</span>
<span class="font-['Inter'] text-xs font-light tracking-wide text-emerald-100 opacity-70">
                © 2024 Sarawak Forestry Corporation. All rights reserved.
            </span>
</div>
<div class="flex flex-wrap justify-center gap-8">
<a class="font-['Inter'] text-xs font-light tracking-wide text-emerald-100 opacity-70 hover:opacity-100 hover:text-red-500 transition-colors" href="#">Accessibility</a>
<a class="font-['Inter'] text-xs font-light tracking-wide text-emerald-100 opacity-70 hover:opacity-100 hover:text-red-500 transition-colors" href="#">Privacy Policy</a>
<a class="font-['Inter'] text-xs font-light tracking-wide text-emerald-100 opacity-70 hover:opacity-100 hover:text-red-500 transition-colors" href="#">Institutional Links</a>
<a class="font-['Inter'] text-xs font-light tracking-wide text-emerald-100 opacity-70 hover:opacity-100 hover:text-red-500 transition-colors" href="#">Contact Sentinel</a>
</div>
</footer>
</body></html>



## Superadmin Dashboard
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Digital Sentinel | Guardian Portal</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              "on-tertiary-fixed-variant": "#930007",
              "primary": "#012d1d",
              "on-surface": "#191c1d",
              "surface-bright": "#f8f9fa",
              "surface": "#f8f9fa",
              "surface-container-highest": "#e1e3e4",
              "inverse-on-surface": "#f0f1f2",
              "on-secondary-container": "#526772",
              "error-container": "#ffdad6",
              "on-primary-container": "#86af99",
              "tertiary-fixed-dim": "#ffb4aa",
              "secondary-fixed-dim": "#b4cad6",
              "on-surface-variant": "#414844",
              "tertiary-fixed": "#ffdad5",
              "on-secondary-fixed": "#071e27",
              "on-primary-fixed": "#002114",
              "surface-variant": "#e1e3e4",
              "on-tertiary-fixed": "#410001",
              "surface-container": "#edeeef",
              "on-error": "#ffffff",
              "error": "#ba1a1a",
              "inverse-primary": "#a5d0b9",
              "on-primary-fixed-variant": "#274e3d",
              "surface-tint": "#3f6653",
              "primary-container": "#1b4332",
              "outline": "#717973",
              "inverse-surface": "#2e3132",
              "on-error-container": "#93000a",
              "outline-variant": "#c1c8c2",
              "on-secondary": "#ffffff",
              "tertiary-container": "#7e0005",
              "on-tertiary": "#ffffff",
              "background": "#f8f9fa",
              "secondary-fixed": "#cfe6f2",
              "surface-container-lowest": "#ffffff",
              "on-primary": "#ffffff",
              "surface-container-low": "#f3f4f5",
              "on-secondary-fixed-variant": "#354a53",
              "primary-fixed-dim": "#a5d0b9",
              "surface-container-high": "#e7e8e9",
              "tertiary": "#550002",
              "on-tertiary-container": "#ff8172",
              "secondary-container": "#cfe6f2",
              "primary-fixed": "#c1ecd4",
              "secondary": "#4c616c",
              "on-background": "#191c1d",
              "surface-dim": "#d9dadb"
            },
            fontFamily: {
              "headline": ["Inter"],
              "body": ["Inter"],
              "label": ["Inter"]
            },
            borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},
          },
        },
      }
    </script>
<style>
        body { font-family: 'Inter', sans-serif; }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .sentinel-overlay {
            background-blend-mode: color-burn;
            background-color: rgba(1, 45, 29, 0.2);
        }
    </style>
</head>
<body class="bg-surface text-on-surface flex min-h-screen">
<!-- SideNavBar -->
<aside class="h-screen w-64 fixed left-0 top-0 z-40 bg-slate-50 flex flex-col p-4">
<div class="mb-10 px-4">
<h1 class="font-black text-emerald-900 text-xl tracking-tighter">Guardian Portal</h1>
<p class="text-[0.6875rem] uppercase tracking-widest text-slate-500 font-medium">Biodiversity Unit</p>
</div>
<nav class="flex-1 space-y-2">
<a class="flex items-center gap-3 bg-emerald-100 text-emerald-900 rounded-xl px-4 py-3 transition-all duration-200 translate-x-1" href="#">
<span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
<span class="font-['Inter'] font-medium text-sm uppercase tracking-widest">Overview</span>
</a>
<a class="flex items-center gap-3 text-slate-500 px-4 py-3 hover:bg-slate-200 rounded-xl transition-all" href="#">
<span class="material-symbols-outlined" data-icon="forest">forest</span>
<span class="font-['Inter'] font-medium text-sm uppercase tracking-widest">Ranger Track</span>
</a>
<a class="flex items-center gap-3 text-slate-500 px-4 py-3 hover:bg-slate-200 rounded-xl transition-all" href="#">
<span class="material-symbols-outlined" data-icon="explore">explore</span>
<span class="font-['Inter'] font-medium text-sm uppercase tracking-widest">Guide Track</span>
</a>
<a class="flex items-center gap-3 text-slate-500 px-4 py-3 hover:bg-slate-200 rounded-xl transition-all" href="#">
<span class="material-symbols-outlined" data-icon="warning">warning</span>
<span class="font-['Inter'] font-medium text-sm uppercase tracking-widest">Incidents</span>
</a>
<a class="flex items-center gap-3 text-slate-500 px-4 py-3 hover:bg-slate-200 rounded-xl transition-all" href="#">
<span class="material-symbols-outlined" data-icon="leaderboard">leaderboard</span>
<span class="font-['Inter'] font-medium text-sm uppercase tracking-widest">Analytics</span>
</a>
</nav>
<div class="mt-auto space-y-2 pt-6">
<button class="w-full bg-[#DC2E27] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all">
<span class="material-symbols-outlined" data-icon="emergency" style="font-variation-settings: 'FILL' 1;">emergency</span>
                Live Incident
            </button>
<div class="pt-4 space-y-1">
<a class="flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-200 rounded-xl transition-all" href="#">
<span class="material-symbols-outlined text-sm" data-icon="help">help</span>
<span class="font-['Inter'] font-medium text-[0.6875rem] uppercase tracking-widest">Support</span>
</a>
<a class="flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-200 rounded-xl transition-all" href="#">
<span class="material-symbols-outlined text-sm" data-icon="history">history</span>
<span class="font-['Inter'] font-medium text-[0.6875rem] uppercase tracking-widest">Archive</span>
</a>
</div>
</div>
</aside>
<!-- Main Content Canvas -->
<main class="ml-64 flex-1 flex flex-col min-h-screen">
<!-- TopAppBar -->
<header class="bg-emerald-950/90 backdrop-blur-xl sticky top-0 z-50 flex justify-between items-center w-full px-12 py-4 shadow-[0_20px_40px_rgba(25,28,29,0.06)]">
<div class="flex items-center gap-12">
<div class="text-xl font-bold tracking-tighter text-white">Digital Sentinel</div>
<nav class="hidden md:flex gap-8 items-center">
<a class="text-emerald-100/70 hover:text-white transition-colors font-['Inter'] tracking-tight antialiased" href="#">Training</a>
<a class="text-emerald-100/70 hover:text-white transition-colors font-['Inter'] tracking-tight antialiased" href="#">Programmes</a>
<a class="text-white border-b-2 border-[#DC2E27] pb-1 font-['Inter'] tracking-tight antialiased" href="#">Dashboard</a>
</nav>
</div>
<div class="flex items-center gap-6">
<div class="relative">
<span class="material-symbols-outlined text-white hover:bg-white/10 p-2 rounded-full cursor-pointer transition-all" data-icon="notifications">notifications</span>
<span class="absolute top-2 right-2 w-2 h-2 bg-[#DC2E27] rounded-full"></span>
</div>
<span class="material-symbols-outlined text-white hover:bg-white/10 p-2 rounded-full cursor-pointer transition-all" data-icon="settings">settings</span>
<div class="h-10 w-10 rounded-full border-2 border-emerald-500/30 overflow-hidden">
<img class="w-full h-full object-cover" data-alt="close-up portrait of professional forestry management head with confident expression in natural outdoor lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDgIxZmeiZeZDET3EuKXw7enwfpgCapMRVfK7qRdKPzqCPcNkXt9m6_CSikzwoooR-b0tJ-j8UB7WfvC0g0atZjL31N4KUdFH6q01O1XfXGs2T7sUwW8mW_hPuLRYZvku9gp3u8UPEo_0TLDCCfoUAJDYk2qM0Qwe7HEWzqQYJBsnu7vKiohq1B9ejTI_--hUHERvNyI1KxLNMr0gBPeHp3mnyiMvb0bqSvMHs8O2bHCFPjwa-7cxeSOtgdis_BTX7Nu3UZzmOWJL02"/>
</div>
</div>
</header>
<section class="p-8 space-y-8">
<!-- Hero Stats Grid -->
<div class="grid grid-cols-1 md:grid-cols-4 gap-6">
<div class="bg-surface-container-low p-6 rounded-xl space-y-2 border-l-4 border-primary">
<p class="text-label text-on-surface-variant uppercase text-[0.6875rem] font-bold tracking-widest">Active Rangers</p>
<div class="flex items-end justify-between">
<span class="text-3xl font-black text-primary">1,248</span>
<span class="text-primary-container text-xs font-bold">+12% vs LW</span>
</div>
</div>
<div class="bg-surface-container-low p-6 rounded-xl space-y-2 border-l-4 border-primary">
<p class="text-label text-on-surface-variant uppercase text-[0.6875rem] font-bold tracking-widest">Training Modules</p>
<div class="flex items-end justify-between">
<span class="text-3xl font-black text-primary">86%</span>
<span class="text-primary-container text-xs font-bold">Completion</span>
</div>
</div>
<div class="bg-surface-container-low p-6 rounded-xl space-y-2 border-l-4 border-[#DC2E27]">
<p class="text-label text-on-surface-variant uppercase text-[0.6875rem] font-bold tracking-widest">Active Incidents</p>
<div class="flex items-end justify-between">
<span class="text-3xl font-black text-[#DC2E27]">04</span>
<span class="text-[#DC2E27] text-xs font-bold animate-pulse">High Priority</span>
</div>
</div>
<div class="bg-surface-container-low p-6 rounded-xl space-y-2 border-l-4 border-secondary">
<p class="text-label text-on-surface-variant uppercase text-[0.6875rem] font-bold tracking-widest">Analytics Score</p>
<div class="flex items-end justify-between">
<span class="text-3xl font-black text-secondary">9.4</span>
<span class="text-secondary-container text-xs font-bold">System Health</span>
</div>
</div>
</div>
<!-- Bento Grid Content -->
<div class="grid grid-cols-12 gap-8 items-start">
<!-- Main Sentinel Feed -->
<div class="col-span-12 lg:col-span-8 space-y-8">
<div class="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(25,28,29,0.06)]">
<div class="relative h-64 overflow-hidden sentinel-overlay">
<img class="w-full h-full object-cover" data-alt="lush green rainforest canopy viewed from above with mystical morning mist and soft diffused sunlight" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDWxkNCUtWRxK11NWAfZmpzjGiTWaQLO2PU9wfGY5UL4mNY1cjKBeuaVfoE1_wJSytKS-_-tjtnb0Gfyf_SQHSKxlyxKEJOg-lQbqvjV8QB-OJJnBbEBDihFTrgGdo-rIN97RMIa1P-X2x08mdNiIHMNInpDcQNCoaxbjG561_UwERMq5cD-mlmzCiyLA8wYEZlu0HqloUiEuxLAN_UbuNEaorDYJKGGvMso_WDD7xvZXksSNHr3rKAkFteQYfJjrrE_pcBKxOKzjgr"/>
<div class="absolute inset-0 p-8 flex flex-col justify-end bg-gradient-to-t from-primary/80 to-transparent">
<h2 class="text-white text-3xl font-bold tracking-tight">Zone Alpha Surveillance</h2>
<p class="text-emerald-100/80 max-w-md">Real-time biodiversity monitoring and training track integration for Bako National Park.</p>
</div>
<div class="absolute top-6 right-6 flex gap-2">
<span class="bg-primary/40 backdrop-blur-md text-white text-[0.625rem] px-3 py-1 rounded-full uppercase tracking-tighter border border-white/20">Live GPS Active</span>
<span class="bg-[#DC2E27]/40 backdrop-blur-md text-white text-[0.625rem] px-3 py-1 rounded-full uppercase tracking-tighter border border-white/20">AI Detection On</span>
</div>
</div>
<div class="p-8">
<div class="flex justify-between items-center mb-6">
<h3 class="text-xl font-bold text-primary">Training Alerts &amp; Incidents</h3>
<button class="text-primary text-sm font-bold flex items-center gap-2 hover:underline">
                                    View Full Report <span class="material-symbols-outlined text-sm" data-icon="arrow_forward">arrow_forward</span>
</button>
</div>
<div class="space-y-4">
<div class="flex items-center gap-6 p-4 bg-surface-container-low rounded-xl group hover:bg-surface-container-high transition-all">
<div class="h-12 w-12 rounded-full bg-[#DC2E27]/10 flex items-center justify-center text-[#DC2E27]">
<span class="material-symbols-outlined" data-icon="report_problem" style="font-variation-settings: 'FILL' 1;">report_problem</span>
</div>
<div class="flex-1">
<div class="flex justify-between items-start">
<h4 class="font-bold text-primary">Unsanctioned Movement Detected</h4>
<span class="text-[0.625rem] text-on-surface-variant font-medium">02 MIN AGO</span>
</div>
<p class="text-sm text-secondary">Grid 42-B. 3 individuals without active permits. Ranger team dispatching.</p>
</div>
<button class="bg-primary text-white text-xs px-4 py-2 rounded-lg font-bold opacity-0 group-hover:opacity-100 transition-all">Assign Guide</button>
</div>
<div class="flex items-center gap-6 p-4 bg-surface-container-low rounded-xl group hover:bg-surface-container-high transition-all">
<div class="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800">
<span class="material-symbols-outlined" data-icon="school" style="font-variation-settings: 'FILL' 1;">school</span>
</div>
<div class="flex-1">
<div class="flex justify-between items-start">
<h4 class="font-bold text-primary">Module Completion: Advanced Tracking</h4>
<span class="text-[0.625rem] text-on-surface-variant font-medium">14 MIN AGO</span>
</div>
<p class="text-sm text-secondary">Ahmad bin Yusuf (Ranger ID: SFC-771) has completed the certification.</p>
</div>
<button class="bg-primary text-white text-xs px-4 py-2 rounded-lg font-bold opacity-0 group-hover:opacity-100 transition-all">Verify Bio</button>
</div>
<div class="flex items-center gap-6 p-4 bg-surface-container-low rounded-xl group hover:bg-surface-container-high transition-all">
<div class="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-800">
<span class="material-symbols-outlined" data-icon="info" style="font-variation-settings: 'FILL' 1;">info</span>
</div>
<div class="flex-1">
<div class="flex justify-between items-start">
<h4 class="font-bold text-primary">System Update: Biodiversity 2.4</h4>
<span class="text-[0.625rem] text-on-surface-variant font-medium">1 HOUR AGO</span>
</div>
<p class="text-sm text-secondary">New AR overlays added for orchid identification in Guide Track.</p>
</div>
<button class="bg-primary text-white text-xs px-4 py-2 rounded-lg font-bold opacity-0 group-hover:opacity-100 transition-all">Release Notes</button>
</div>
</div>
</div>
</div>
</div>
<!-- Right Sidebar Widgets -->
<div class="col-span-12 lg:col-span-4 space-y-8">
<!-- Live Map Tracker -->
<div class="bg-surface-container-lowest p-6 rounded-xl shadow-[0_20px_40px_rgba(25,28,29,0.06)] space-y-6">
<div class="flex justify-between items-center">
<h3 class="text-lg font-bold text-primary">Active Patrols</h3>
<span class="text-[0.625rem] text-emerald-600 bg-emerald-50 px-2 py-1 rounded font-bold uppercase">12 Teams Out</span>
</div>
<div class="aspect-square rounded-xl overflow-hidden relative border border-outline-variant/15">
<img class="w-full h-full object-cover grayscale brightness-50" data-alt="top-down satellite topographic map of dense tropical rainforest area with contour lines and digital coordinate overlays" data-location="Sarawak, Malaysia" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvP4a8m9thL2ca_veg-GcbzCdIJLEFFyIxpJwP_nklS6AWN0bdNIZ89rD-9nLBTMfwBHz0rByHvfeWE2v29dsgHKnAjQjCkLuC6WnEfxcL4IYfCMWUNvbWmA1sHq0zHd-DeE6mq8sALmF6_nr0v0ErVT_tpKd7-_Kin1xD6Zaa6nmOsIqJvoZLAZ9BhC2EN46l9lj6dy3Bc4xW9Y5Ac7Pp0c2gPoDpGhE2YSGxCLFGzgDN1QdAQLPC5r3aZrFYkgP-0zWu5AxJsxnS"/>
<div class="absolute inset-0 bg-primary/20"></div>
<!-- Map UI Overlays -->
<div class="absolute top-4 left-4 flex flex-col gap-1">
<div class="bg-white/90 backdrop-blur-sm p-1.5 rounded-lg shadow-sm flex items-center gap-2">
<div class="w-2 h-2 rounded-full bg-[#DC2E27] animate-ping"></div>
<span class="text-[0.5rem] font-bold text-primary uppercase">POI 02: Alert</span>
</div>
<div class="bg-emerald-950/90 backdrop-blur-sm p-1.5 rounded-lg shadow-sm flex items-center gap-2">
<div class="w-2 h-2 rounded-full bg-emerald-400"></div>
<span class="text-[0.5rem] font-bold text-white uppercase">Team Alpha: Active</span>
</div>
</div>
<!-- Coordinate Tech Grid -->
<div class="absolute bottom-4 right-4 text-[10px] text-emerald-400/80 font-mono tracking-tighter leading-none text-right">
                                LAT: 1.5533° N<br/>LON: 110.3592° E<br/>ALT: 42M
                            </div>
</div>
<div class="space-y-4">
<div class="flex items-center gap-3">
<div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
<span class="material-symbols-outlined text-primary text-xl" data-icon="person">person</span>
</div>
<div class="flex-1">
<p class="text-xs font-bold text-primary">Sgt. Tan Boon</p>
<p class="text-[10px] text-secondary">Ranger Track Level 4</p>
</div>
<div class="text-right">
<p class="text-[10px] font-mono text-emerald-700">Patrolling</p>
<div class="h-1 w-12 bg-emerald-200 rounded-full mt-1"><div class="h-1 w-8 bg-emerald-500 rounded-full"></div></div>
</div>
</div>
<div class="flex items-center gap-3">
<div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
<span class="material-symbols-outlined text-primary text-xl" data-icon="person">person</span>
</div>
<div class="flex-1">
<p class="text-xs font-bold text-primary">Rgr. Siti Aminah</p>
<p class="text-[10px] text-secondary">Guide Track Level 2</p>
</div>
<div class="text-right">
<p class="text-[10px] font-mono text-emerald-700">Patrolling</p>
<div class="h-1 w-12 bg-emerald-200 rounded-full mt-1"><div class="h-1 w-4 bg-emerald-500 rounded-full"></div></div>
</div>
</div>
</div>
</div>
<!-- Analytics Mini-Widget -->
<div class="bg-primary text-white p-6 rounded-xl space-y-4 relative overflow-hidden">
<div class="relative z-10">
<h3 class="text-sm font-bold text-emerald-100 uppercase tracking-widest">Incident Response Time</h3>
<div class="flex items-baseline gap-2 mt-2">
<span class="text-3xl font-black">4.2m</span>
<span class="text-emerald-400 text-xs">-1.8m from last month</span>
</div>
<div class="mt-6 h-12 flex items-end gap-1">
<div class="flex-1 bg-white/10 rounded-t h-4 hover:bg-white/40 transition-all"></div>
<div class="flex-1 bg-white/10 rounded-t h-6 hover:bg-white/40 transition-all"></div>
<div class="flex-1 bg-white/10 rounded-t h-8 hover:bg-white/40 transition-all"></div>
<div class="flex-1 bg-white/20 rounded-t h-12 hover:bg-white/40 transition-all"></div>
<div class="flex-1 bg-white/10 rounded-t h-7 hover:bg-white/40 transition-all"></div>
<div class="flex-1 bg-white/30 rounded-t h-10 hover:bg-white/40 transition-all"></div>
<div class="flex-1 bg-[#DC2E27] rounded-t h-12"></div>
</div>
</div>
<!-- Abstract Tech Circles -->
<div class="absolute -right-12 -top-12 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
<div class="absolute -left-6 -bottom-6 w-24 h-24 bg-emerald-400/5 rounded-full blur-xl"></div>
</div>
</div>
</div>
</section>
<!-- Footer -->
<footer class="w-full py-8 mt-auto bg-emerald-950 flex flex-col md:flex-row justify-between items-center px-12 gap-4">
<div class="text-sm font-bold text-white">Digital Sentinel <span class="font-normal opacity-50 ml-2">Guardian Portal</span></div>
<div class="flex flex-wrap justify-center gap-6">
<a class="font-['Inter'] text-xs font-light tracking-wide text-emerald-100 opacity-70 hover:opacity-100 hover:text-[#DC2E27] transition-all underline decoration-[#DC2E27]" href="#">Accessibility</a>
<a class="font-['Inter'] text-xs font-light tracking-wide text-emerald-100 opacity-70 hover:opacity-100 hover:text-[#DC2E27] transition-all" href="#">Privacy Policy</a>
<a class="font-['Inter'] text-xs font-light tracking-wide text-emerald-100 opacity-70 hover:opacity-100 hover:text-[#DC2E27] transition-all" href="#">Institutional Links</a>
<a class="font-['Inter'] text-xs font-light tracking-wide text-emerald-100 opacity-70 hover:opacity-100 hover:text-[#DC2E27] transition-all" href="#">Contact Sentinel</a>
</div>
<p class="font-['Inter'] text-xs font-light tracking-wide text-emerald-100 opacity-50">© 2024 Sarawak Forestry Corporation. All rights reserved.</p>
</footer>
</main>
</body></html>








## Sign in page
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>SFC Digital Training | Login</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              "error": "#ba1a1a",
              "primary-container": "#1b4332",
              "surface-container": "#edeeef",
              "inverse-on-surface": "#f0f1f2",
              "tertiary-fixed-dim": "#ffb4aa",
              "on-secondary": "#ffffff",
              "inverse-primary": "#a5d0b9",
              "secondary-container": "#cfe6f2",
              "surface-dim": "#d9dadb",
              "error-container": "#ffdad6",
              "secondary-fixed": "#cfe6f2",
              "inverse-surface": "#2e3132",
              "on-tertiary-fixed": "#410001",
              "on-primary-fixed-variant": "#274e3d",
              "on-surface": "#191c1d",
              "on-tertiary": "#ffffff",
              "surface-container-low": "#f3f4f5",
              "on-secondary-fixed": "#071e27",
              "surface-container-high": "#e7e8e9",
              "on-error": "#ffffff",
              "on-secondary-container": "#526772",
              "tertiary-fixed": "#ffdad5",
              "secondary-fixed-dim": "#b4cad6",
              "primary-fixed-dim": "#a5d0b9",
              "secondary": "#4c616c",
              "background": "#f8f9fa",
              "surface-container-highest": "#e1e3e4",
              "on-tertiary-fixed-variant": "#930007",
              "on-primary-fixed": "#002114",
              "on-primary-container": "#86af99",
              "surface-variant": "#e1e3e4",
              "surface-container-lowest": "#ffffff",
              "on-surface-variant": "#414844",
              "on-primary": "#ffffff",
              "surface-bright": "#f8f9fa",
              "outline": "#717973",
              "tertiary": "#550002",
              "surface": "#f8f9fa",
              "on-error-container": "#93000a",
              "on-tertiary-container": "#ff8172",
              "primary-fixed": "#c1ecd4",
              "outline-variant": "#c1c8c2",
              "tertiary-container": "#7e0005",
              "surface-tint": "#3f6653",
              "on-secondary-fixed-variant": "#354a53",
              "on-background": "#191c1d",
              "primary": "#012d1d"
            },
            fontFamily: {
              "headline": ["Inter"],
              "body": ["Inter"],
              "label": ["Inter"]
            },
            borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},
          },
        },
      }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .glass-panel {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
        }
    </style>
</head>
<body class="bg-background font-body text-on-surface flex min-h-screen items-center justify-center relative overflow-hidden">
<!-- Background Layer with "Sentinel Overlay" Logic -->
<div class="absolute inset-0 z-0">
<div class="absolute inset-0 bg-primary/30 mix-blend-multiply z-10"></div>
<img class="w-full h-full object-cover grayscale-[20%] blur-sm scale-105" data-alt="cinematic wide shot of a misty tropical rainforest canopy in Sarawak at dawn with deep green tones and atmospheric haze" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDWE3cjv4nJ8eXkssiZoLQlSADIfTGBZvPeOE44CeEMoEEfVT72piwpv29MJ39iVqxpJAmA5C0QtwdfUA0sZaMsXmuU3VKSeSGqE3N-M9xHIfqEOupar1Wv2knKvXyogSAwGk53hdPCLWTvbBtUsjywzZ1gdyLFxBUPRdrcD7H-dH_CdDCji-W9Vw0jfZkxPSTqD49uObk-dOlIqWA_Cf7e8PtjtUlTn5G9FfoWIpV5GVAZFqYBJVrsi_w6EGxWNpP4cBoGw_iATDKs"/>
</div>
<!-- Decorative Elements (The Tech-Nature Synthesis) -->
<div class="absolute top-10 left-10 hidden lg:block opacity-40 z-20">
<div class="text-[10px] font-mono text-white tracking-[0.2em] leading-relaxed uppercase">
            Coord: 1.5533° N, 110.3592° E<br/>
            Sentinel Active: 04 nodes<br/>
            System: Canopy Intelligence v4.2
        </div>
</div>
<!-- Main Content Canvas -->
<main class="w-full max-w-[480px] px-6 relative z-30">
<div class="glass-panel p-8 md:p-12 rounded-xl shadow-2xl shadow-primary/20 flex flex-col gap-8">
<!-- Logo & Identity -->
<div class="flex flex-col items-center text-center">
<div class="mb-6 relative">
<div class="w-20 h-20 bg-primary rounded-xl flex items-center justify-center p-3 shadow-lg shadow-primary/30">
<img class="w-full h-full object-contain invert brightness-0" data-alt="minimalist professional logo of Sarawak Forestry Corporation showing an abstract hornbill and forest motifs in white" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB6niFxsn_oyD8vqO4SCkPMico4hk6EyloOAtgUtWPOYA7W1q4GA50kPr88hXScha2dANueSUUjoQRp35P_8OF1gFBEcT4ix-l1s2JfSUHZB5ySqn_3MOxbV6YYu5-0-agizJNb7evi4XgSCVSzi1Zauo0pCE6sVX8sxQ2UROmxKL77tHvHBcDssQ5HHw3GcJZN3sLrKbp4s2HzSZsTinXD3LD3ElfqpyaHoyM-KuASGrItp-ZDr-HQL3YNcVMbeIlAPZeTAvuRkVIj"/>
</div>
</div>
<h1 class="text-3xl font-black tracking-tighter text-primary uppercase leading-tight">
                    SFC Digital Training
                </h1>
<p class="text-secondary font-medium text-sm mt-2 tracking-wide uppercase">
                    Forestry Training Command
                </p>
</div>
<!-- Authentication Actions -->
<div class="flex flex-col gap-4">
<!-- SSO Provider -->
<button class="w-full h-14 bg-surface-container-lowest hover:bg-white flex items-center justify-center gap-3 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] outline outline-1 outline-outline-variant/15">
<img alt="Google Logo" class="w-6 h-6" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBYJgyoNMRiXjmLSB1SYvARyIMvvhArJrheKhN-oCkOyG0dcv1NGRrJoVcMfgvkO3S70_dh9HVwdSKXi6dXBPJIBcFx5FzemCM6EQ2nUw3vjsYz4BdvANF8uVHodHNu9FngiJawjLKfiOhGgvi_z3GDwC37v2wiymhBvxMaii8qLj0uQtzfsXfrEg0n-HY2cT2MCBmwW89xUifCa2vLIihTqQfqpXs0zE7S_iBpKcd2_SCQ5k22j3P24mUGC5NjDaCqwrrDEGmpVBpL"/>
<span class="font-semibold text-on-surface text-sm">Sign in with Google</span>
</button>
<div class="flex items-center gap-4 py-2">
<div class="h-[1px] flex-1 bg-outline-variant/20"></div>
<span class="text-[10px] uppercase tracking-widest text-secondary font-bold">Or use email</span>
<div class="h-[1px] flex-1 bg-outline-variant/20"></div>
</div>
<!-- Credential Form -->
<form class="flex flex-col gap-5">
<div class="flex flex-col gap-2">
<label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-1" for="email">Work Email</label>
<div class="relative group">
<span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">alternate_email</span>
<input class="w-full h-14 pl-12 pr-4 bg-surface-container-high border-0 rounded-xl focus:ring-2 focus:ring-surface-tint focus:bg-white transition-all placeholder:text-outline/50 font-medium" id="email" name="email" placeholder="name@forestry.gov.my" type="email"/>
</div>
</div>
<div class="flex flex-col gap-2">
<div class="flex justify-between items-center px-1">
<label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant" for="password">Password</label>
<a class="text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-primary transition-colors" href="#">Forgot Password?</a>
</div>
<div class="relative group">
<span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">lock</span>
<input class="w-full h-14 pl-12 pr-4 bg-surface-container-high border-0 rounded-xl focus:ring-2 focus:ring-surface-tint focus:bg-white transition-all placeholder:text-outline/50 font-medium" id="password" name="password" placeholder="••••••••" type="password"/>
</div>
</div>
<button class="w-full h-14 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-sm mt-4 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2" type="submit">
                        Enter Sentinel
                        <span class="material-symbols-outlined text-xl">arrow_forward</span>
</button>
</form>
</div>
<!-- Footer Links -->
<div class="flex flex-col items-center gap-6">
<p class="text-sm text-on-surface-variant font-medium">
                    Don't have an account? 
                    <a class="text-primary font-bold hover:underline underline-offset-4" href="#">Register</a>
</p>
<div class="flex gap-4 items-center">
<a class="text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-on-surface transition-colors" href="#">Privacy</a>
<div class="w-1 h-1 rounded-full bg-outline-variant"></div>
<a class="text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-on-surface transition-colors" href="#">Security</a>
<div class="w-1 h-1 rounded-full bg-outline-variant"></div>
<a class="text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-on-surface transition-colors" href="#">SFC Website</a>
</div>
</div>
</div>
<!-- System Status Bar (Asymmetric/Tech Detail) -->
<div class="mt-8 flex justify-between items-center px-2 opacity-60">
<div class="flex items-center gap-2">
<div class="w-2 h-2 rounded-full bg-tertiary animate-pulse"></div>
<span class="text-[10px] font-bold text-white uppercase tracking-tighter">Live Incident Feed: Active</span>
</div>
<span class="text-[10px] font-medium text-white/70 uppercase">v4.2.0-Production</span>
</div>
</main>
<!-- Bottom Copyright -->
<footer class="absolute bottom-6 w-full text-center z-30">
<p class="text-[9px] font-bold text-white/50 uppercase tracking-[0.3em]">
            © 2024 Sarawak Forestry Corporation. Guardians of Biodiversity.
        </p>
</footer>
</body></html>