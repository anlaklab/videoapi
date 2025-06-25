/**
 * Styled Components Fix - Utility to prevent prop warnings
 * 
 * This utility helps prevent styled-components from passing
 * custom props to DOM elements, which causes React warnings.
 */

// List of custom props that should not be forwarded to DOM
const customProps = new Set([
  'active',
  'primary',
  'secondary',
  'danger',
  'success',
  'warning',
  'shimmer',
  'collapsed',
  'expanded',
  'loading',
  'disabled',
  'selected',
  'highlighted',
  'focused',
  'hovered',
  'pressed',
  'show',
  'hide',
  'visible',
  'hidden',
  'major',
  'minor',
  'position',
  'isOpen',
  'isClosed',
  'isActive',
  'isDisabled',
  'isSelected',
  'isLoading',
  'variant',
  'size',
  'color',
  'theme'
]);

/**
 * Function to determine if a prop should be forwarded to DOM
 * Use this with styled-components shouldForwardProp
 */
export const shouldForwardProp = (prop, defaultValidatorFn) => {
  // Don't forward custom props
  if (customProps.has(prop)) {
    return false;
  }
  
  // Don't forward transient props (those starting with $)
  if (prop.startsWith('$')) {
    return false;
  }
  
  // Use default validation for other props
  return defaultValidatorFn ? defaultValidatorFn(prop) : true;
};

/**
 * Wrapper function to create styled components with proper prop filtering
 */
export const createStyledComponent = (component) => {
  return component.withConfig({
    shouldForwardProp: shouldForwardProp
  });
};

export default { shouldForwardProp, createStyledComponent }; 