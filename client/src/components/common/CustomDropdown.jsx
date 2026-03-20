
import React, { useState, useRef, useEffect } from 'react';
import './CustomDropdown.css';

/**
 * Custom Dropdown Component
 * Replaces native <select> for better styling control.
 * 
 * @param {Object} props
 * @param {Array} props.options - Array of options. Each option can be a string or object { value, label, ... }
 * @param {string|number} props.value - Currently selected value
 * @param {Function} props.onChange - Callback when value changes. Returns the value.
 * @param {string} props.placeholder - Text to show when no selection
 * @param {string} props.labelKey - Key to use for label if options are objects (default: 'label')
 * @param {string} props.valueKey - Key to use for value if options are objects (default: 'value')
 * @param {boolean} props.disabled - Whether the dropdown is disabled
 * @param {string} props.className - Additional classes
 */
const CustomDropdown = ({
    options = [],
    value,
    onChange,
    placeholder = "Select an option",
    labelKey = "label",
    valueKey = "value",
    disabled = false,
    searchable = false,
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Reset search term when dropdown opens/closes
    useEffect(() => {
        if (!isOpen) setSearchTerm('');
    }, [isOpen]);

    const handleSelect = (option) => {
        if (typeof option === 'object') {
            onChange(option[valueKey]);
        } else {
            onChange(option);
        }
        setIsOpen(false);
    };

    // Find selected option object/value to display
    const selectedOption = options.find(opt => {
        if (typeof opt === 'object') {
            return opt[valueKey] === value;
        }
        return opt === value;
    });

    const getDisplayLabel = (option) => {
        if (!option) return placeholder;
        if (typeof option === 'object') {
            return option[labelKey];
        }
        return option;
    };

    // Filter options based on search term
    const filteredOptions = options.filter(option => {
        if (!searchable || !searchTerm) return true;
        const label = getDisplayLabel(option);
        return label?.toString().toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div
            className={`custom-dropdown ${className} ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
            ref={dropdownRef}
        >
            <div className="custom-tooltip-wrapper">
                <div
                    className="dropdown-trigger"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                >
                    <span className={`selected-value ${!selectedOption ? 'placeholder' : ''}`}>
                        {selectedOption ? getDisplayLabel(selectedOption) : placeholder}
                    </span>
                    <span className="dropdown-arrow">▼</span>
                </div>
                {selectedOption && getDisplayLabel(selectedOption).length > 25 && !isOpen && (
                    <span className="custom-tooltip-text">{getDisplayLabel(selectedOption)}</span>
                )}
            </div>

            {isOpen && (
                <div className="dropdown-menu">
                    {searchable && (
                        <div className="dropdown-search">
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}
                    {filteredOptions.length === 0 ? (
                        <div className="dropdown-item no-options">No options available</div>
                    ) : (
                        filteredOptions.map((option, index) => {
                            const isSelected = selectedOption === option || (typeof option === 'object' && option[valueKey] === value);
                            const label = typeof option === 'object' ? option[labelKey] : option;
                            const key = typeof option === 'object' ? option[valueKey] : index; // Fallback to index if string

                            return (
                                <div
                                    key={key}
                                    className={`dropdown-item ${isSelected ? 'selected' : ''}`}
                                    onClick={() => handleSelect(option)}
                                >
                                    {label}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

export default CustomDropdown;
