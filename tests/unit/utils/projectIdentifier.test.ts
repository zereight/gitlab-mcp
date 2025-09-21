import {
  processProjectIdentifier,
  safeEncodeProjectId,
  normalizeProjectId,
  validateProjectIdentifier
} from '../../../src/utils/projectIdentifier';

describe('projectIdentifier', () => {
  describe('processProjectIdentifier', () => {
    it('should handle numeric IDs', () => {
      const result = processProjectIdentifier('123');

      expect(result.identifier).toBe('123');
      expect(result.isNumericId).toBe(true);
      expect(result.originalValue).toBe('123');
    });

    it('should handle numeric IDs with whitespace', () => {
      const result = processProjectIdentifier('  456  ');

      expect(result.identifier).toBe('456');
      expect(result.isNumericId).toBe(true);
      expect(result.originalValue).toBe('  456  ');
    });

    it('should handle URL-encoded namespace paths', () => {
      const result = processProjectIdentifier('group%2Fproject');

      expect(result.identifier).toBe('group%2Fproject');
      expect(result.isNumericId).toBe(false);
      expect(result.originalValue).toBe('group%2Fproject');
    });

    it('should encode regular namespace paths', () => {
      const result = processProjectIdentifier('group/project');

      expect(result.identifier).toBe('group%2Fproject');
      expect(result.isNumericId).toBe(false);
      expect(result.originalValue).toBe('group/project');
    });

    it('should handle complex URL-encoded paths', () => {
      const result = processProjectIdentifier('test%2Fsubgroup%2Fproject-name');

      expect(result.identifier).toBe('test%2Fsubgroup%2Fproject-name');
      expect(result.isNumericId).toBe(false);
      expect(result.originalValue).toBe('test%2Fsubgroup%2Fproject-name');
    });

    it('should encode complex regular paths', () => {
      const result = processProjectIdentifier('test/subgroup/project-name');

      expect(result.identifier).toBe('test%2Fsubgroup%2Fproject-name');
      expect(result.isNumericId).toBe(false);
      expect(result.originalValue).toBe('test/subgroup/project-name');
    });
  });

  describe('safeEncodeProjectId', () => {
    it('should not double-encode already encoded paths', () => {
      const result = safeEncodeProjectId('group%2Fproject');
      expect(result).toBe('group%2Fproject');
    });

    it('should encode regular paths', () => {
      const result = safeEncodeProjectId('group/project');
      expect(result).toBe('group%2Fproject');
    });

    it('should handle numeric IDs', () => {
      const result = safeEncodeProjectId('123');
      expect(result).toBe('123');
    });
  });

  describe('normalizeProjectId', () => {
    it('should normalize numeric IDs', () => {
      const result = normalizeProjectId('789');
      expect(result).toBe('789');
    });

    it('should normalize URL-encoded paths', () => {
      const result = normalizeProjectId('group%2Fproject');
      expect(result).toBe('group%2Fproject');
    });

    it('should normalize regular paths', () => {
      const result = normalizeProjectId('group/project');
      expect(result).toBe('group%2Fproject');
    });
  });

  describe('validateProjectIdentifier', () => {
    it('should validate numeric IDs', () => {
      expect(validateProjectIdentifier('123')).toBeNull();
      expect(validateProjectIdentifier('0')).toBeNull();
      expect(validateProjectIdentifier('999999')).toBeNull();
    });

    it('should validate namespace paths', () => {
      expect(validateProjectIdentifier('group/project')).toBeNull();
      expect(validateProjectIdentifier('group%2Fproject')).toBeNull();
      expect(validateProjectIdentifier('test/subgroup/project-name')).toBeNull();
      expect(validateProjectIdentifier('test-group/project_name')).toBeNull();
    });

    it('should reject invalid inputs', () => {
      expect(validateProjectIdentifier('')).toBe('Project identifier is required and must be a string');
      expect(validateProjectIdentifier('   ')).toBe('Project identifier cannot be empty');
      expect(validateProjectIdentifier(null as any)).toBe('Project identifier is required and must be a string');
      expect(validateProjectIdentifier(undefined as any)).toBe('Project identifier is required and must be a string');
      expect(validateProjectIdentifier(123 as any)).toBe('Project identifier is required and must be a string');
    });

    it('should reject invalid characters', () => {
      const invalidPath = 'group/project@invalid';
      const result = validateProjectIdentifier(invalidPath);
      expect(result).toBe('Invalid project identifier format. Use numeric ID or namespace/project path.');
    });

    it('should handle special characters in paths', () => {
      expect(validateProjectIdentifier('group-name/project_name')).toBeNull();
      expect(validateProjectIdentifier('group.name/project.name')).toBeNull();
    });
  });
});