
export type ComplianceCategory = 'A' | 'B' | 'C' | 'D';

export interface ProjectMetadata {
  height?: string;
  storeys?: string;
  units?: string;
  value?: string;
  hrb?: boolean;
  type?: string;
  phased?: boolean;
}

export const determineProjectCategory = (metadata: ProjectMetadata): { 
  category: ComplianceCategory;
  label: string;
  description: string;
  color: string;
} => {
  const { height, storeys, units, value, hrb, type, phased } = metadata;

  // Category A: Higher-Risk Buildings (HRB)
  const isHRB = 
    hrb === true || 
    (height && (height.includes('18-30') || height.includes('30-50') || height.includes('Over 50'))) ||
    (storeys && (storeys.includes('7 storeys') || storeys.includes('8-15') || storeys.includes('16-30') || storeys.includes('30+')));

  if (isHRB) {
    return {
      category: 'A',
      label: 'Category A (Higher-Risk)',
      description: 'Higher-Risk Building (HRB) subject to full Building Safety Act 2022 Gateway regime and Golden Thread requirements.',
      color: '#ef4444' // Red/High
    };
  }

  // Category B: Major / Complex Projects
  const isMajor = 
    (units && (units.includes('51-100') || units.includes('101-250') || units.includes('251-500') || units.includes('500+'))) ||
    (value && (value.includes('£5m–£20 million') || value.includes('Over £20 million'))) ||
    phased === true;

  if (isMajor) {
    return {
      category: 'B',
      label: 'Category B (Complex)',
      description: 'Major construction or intensive refurbishment requiring enhanced multi-disciplinary coordination and CDM oversight.',
      color: '#f59e0b' // Amber
    };
  }

  // Category D: Minor Works (Low Complexity)
  const isMinor = 
    (value && (value.includes('Under £50,000') || value.includes('£50,000–£250,000'))) ||
    (type && type.includes('Internal fit-out'));

  if (isMinor) {
    return {
      category: 'D',
      label: 'Category D (Minor Works)',
      description: 'Low-complexity works or maintenance. Focus on standard CDM 2015 duties and health & safety excellence.',
      color: '#10b981' // Green
    };
  }

  // Default to Category C: Standard Construction
  return {
    category: 'C',
    label: 'Category C (Standard)',
    description: 'Standard residential construction or refurbishment projects. Regulated under Building Regulations and CDM 2015.',
    color: '#3b82f6' // Blue
  };
};
