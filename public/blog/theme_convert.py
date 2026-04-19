import os

def process_html_file(filepath):
    print(f"Refactoring theme in {filepath}...")
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return

    replacements = {
        # Core Dark to Light
        'background: #0a0a0a': 'background: #f8fafc',
        'color: #f3f4f6': 'color: #000080',
        'bg-black/85': 'bg-white/85',
        'bg-black/95': 'bg-white/95',
        'bg-black/60': 'bg-white/90 border border-gray-200 text-[#000080] shadow-sm',
        'bg-black': 'bg-white text-[#000080]',
        'bg-zinc-900': 'bg-white shadow-[0_4px_15px_rgba(0,0,128,0.06)] border border-gray-100',
        'bg-zinc-950': 'bg-white shadow-2xl border border-gray-100',
        'bg-gray-900': 'bg-gray-100',
        'bg-[#0a0a0a]': 'bg-[#f8fafc]',
        
        # Text adjustments
        'text-[#f3f4f6]': 'text-[#000080]',
        'text-white': 'text-[#000080]',
        'hover:text-white': 'hover:text-[#fe4f04]',
        'text-gray-400': 'text-gray-500',
        'text-gray-300': 'text-[#000066]',
        'text-gray-200': 'text-gray-700',
        'text-gray-500': 'text-gray-500',
        'text-white/90': 'text-[#000080]',
        
        # Border adjustments
        'border-gray-800/70': 'border-blue-900/10',
        'border-gray-800': 'border-[#e2e8f0]',
        'border-gray-900': 'border-[#e2e8f0]',
        'border-gray-700': 'border-gray-300',
        
        # Gradient aesthetics
        'bg-[radial-gradient(#1f2937_1px,transparent_1px)]': 'bg-[radial-gradient(rgba(0,0,128,0.08)_1px,transparent_1px)]',
        'from-transparent via-black/60 to-black': 'from-transparent via-white/80 to-white',
        'from-gray-800 to-black': 'from-gray-50 to-gray-200',
        'bg-gradient-to-br from-gray-800 to-black': 'bg-gradient-to-br from-[#f8fafc] to-blue-50',
        'backdrop-blur-sm': 'backdrop-blur-xl',
        
        # Scrollbars and Specific Elements
        '::-webkit-scrollbar-track {\n            background: #1a1a1a;': '::-webkit-scrollbar-track {\n            background: #f1f5f9;',
        'prose-invert': 'prose-headings:text-[#000080] prose-p:text-gray-600 prose-a:text-[#fe4f04]',
        'bg-white text-black': 'bg-[#000080] text-white',
        
        # Overrides for Modals & Specific Overlays
        'bg-zinc-900/70': 'bg-gray-50/90 border border-gray-200',
        'bg-transparent border border-gray-700': 'bg-white border border-gray-300',
        
        # Loading spinners 
        'border: 3px solid #1a1a1a;': 'border: 3px solid rgba(0,0,128,0.1);',
        
        # Specific Icon fixes inside buttons 
        'text-[#fe4f04] opacity-90': 'text-[#000080] opacity-90'
    }

    # Custom override for buttons that should stay white text
    # e.g button "POST COMMENT" has bg-[#fe4f04] text-white
    # Before replacement, protect it:
    content = content.replace('bg-[#fe4f04] text-white', 'TEMP_BUTTON_STYLE')

    for old, new in replacements.items():
        content = content.replace(old, new)

    # Restore protected elements
    content = content.replace('TEMP_BUTTON_STYLE', 'bg-[#000080] text-white border-none shadow-[0_4px_15px_rgba(0,0,128,0.2)] hover:bg-[#000066]')

    # Advanced regex fixes for JS generated strings
    import re
    # Fix the JS `text-white` to `text-[#000080]` inside template literals
    # We already did replace 'text-white' but let's ensure buttons that we changed to bg-white text-[#000080] are handled
    
    # Specific fix for Logo text that wasn't perfectly caught
    content = content.replace('text-white text-xs font-bold', 'text-white text-xs font-bold') # Avatar uses white text on orange background
    
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Saved changes to {filepath}")
    except Exception as e:
        print(f"Error writing {filepath}: {e}")

if __name__ == '__main__':
    for filename in os.listdir('.'):
        if filename.endswith('.html'):
            process_html_file(filename)
