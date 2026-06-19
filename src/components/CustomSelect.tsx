import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface CustomSelectProps {
  value?: string | number;
  onChange?: (e: { target: { value: string } }) => void;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  children?: React.ReactNode;
  required?: boolean;
  id?: string;
  positionDirection?: 'up' | 'down' | 'auto';
}

// Helper to recursively extract plain text from React nodes without joining arrays with commas
const getTextFromNode = (node: React.ReactNode): string => {
  if (node === null || node === undefined) {
    return '';
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(getTextFromNode).join('');
  }
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return getTextFromNode(props.children);
  }
  return '';
};

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  className = '',
  style,
  disabled = false,
  children,
  positionDirection = 'auto',
  id
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState<'up' | 'down'>('down');
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract option definitions from children recursively
  const options: { value: string; label: string }[] = [];
  const extractOptions = (nodes: React.ReactNode) => {
    React.Children.forEach(nodes, (child) => {
      if (!child) return;
      if (React.isValidElement(child)) {
        if (child.type === 'option') {
          const props = child.props as { value?: string | number; children?: React.ReactNode };
          const val = props.value !== undefined ? String(props.value) : '';
          const label = props.children ? getTextFromNode(props.children) : val;
          options.push({ value: val, label });
        } else {
          const props = child.props as { children?: React.ReactNode };
          if (props.children) {
            extractOptions(props.children);
          }
        }
      } else if (Array.isArray(child)) {
        extractOptions(child);
      }
    });
  };

  extractOptions(children);

  const selectedOption = options.find((opt) => opt.value === String(value)) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine dropdown opening direction dynamically based on viewport space and scroll container space
  useEffect(() => {
    if (isOpen && containerRef.current) {
      if (positionDirection === 'up') {
        setDirection('up');
      } else if (positionDirection === 'down') {
        setDirection('down');
      } else {
        // Auto detection
        const selectRect = containerRef.current.getBoundingClientRect();
        
        // Find closest parent that might clip or scroll
        let scrollParent: HTMLElement | null = containerRef.current.parentElement;
        while (scrollParent && scrollParent !== document.body) {
          const style = window.getComputedStyle(scrollParent);
          const overflow = style.overflow + style.overflowY + style.overflowX;
          if (
            overflow.includes('auto') || 
            overflow.includes('scroll') || 
            overflow.includes('hidden') || 
            scrollParent.classList.contains('overflow-y-auto')
          ) {
            break;
          }
          scrollParent = scrollParent.parentElement;
        }

        const dropdownHeight = 260; // max-h-64 is 256px + padding/margin
        
        if (scrollParent) {
          const parentRect = scrollParent.getBoundingClientRect();
          const spaceBelowInParent = parentRect.bottom - selectRect.bottom;
          const spaceAboveInParent = selectRect.top - parentRect.top;
          
          if (spaceBelowInParent < dropdownHeight && spaceAboveInParent > spaceBelowInParent) {
            setDirection('up');
          } else {
            setDirection('down');
          }
        } else {
          const spaceBelow = window.innerHeight - selectRect.bottom;
          if (spaceBelow < dropdownHeight && selectRect.top > dropdownHeight) {
            setDirection('up');
          } else {
            setDirection('down');
          }
        }
      }
    }
  }, [isOpen, positionDirection]);

  const handleSelect = (val: string) => {
    if (disabled) return;
    if (onChange) {
      onChange({ target: { value: val } });
    }
    setIsOpen(false);
  };

  // Extract font/text sizing and padding classes if passed, else fallback to default styles
  const defaultClass = "w-full flex items-center justify-between text-left px-3.5 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-toss-blue/15 transition-all text-sm font-bold text-toss-gray-800 dark:text-slate-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
  
  // Clean custom className if it has cds--text-input or toss-input to avoid native select heights/styles
  const buttonClass = className ? `${className} flex items-center justify-between text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed` : defaultClass;

  return (
    <div 
      ref={containerRef} 
      className={`relative inline-block w-full min-w-0 ${isOpen ? 'z-[999]' : 'z-10'}`} 
      style={style}
      id={id}
      data-is-open={isOpen}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`${buttonClass} relative`}
        style={{ paddingRight: '1.75rem' }} // Ensure room for the arrow
      >
        <span className="truncate">{selectedOption ? selectedOption.label : ''}</span>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
          <ChevronDown className={`w-4 h-4 transition-transform text-toss-gray-400 ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen && (
        <div className={`absolute left-0 right-0 ${direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} z-[999] bg-white/95 dark:bg-slate-900/95 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-toss-lg p-1.5 flex flex-col max-h-64 overflow-y-auto backdrop-blur-md animate-scale-in text-left`}>
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-toss-gray-400 font-bold text-center">옵션 없음</div>
          ) : (
            options.map((opt) => {
              const isSelected = String(opt.value) === String(value !== undefined && value !== null ? value : '');
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`flex items-center w-full px-3.5 py-2 rounded-xl text-left transition-colors cursor-pointer text-sm font-bold border-none shrink-0 ${
                    isSelected
                      ? 'custom-select-option-selected'
                      : 'bg-transparent text-toss-gray-700 hover:bg-gray-100 dark:text-slate-350 dark:hover:bg-slate-800/80 font-bold'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
