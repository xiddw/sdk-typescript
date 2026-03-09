import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { StructuredOutputTool } from '../tool.js'

/**
 * Helper to create a StructuredOutputTool and return its toolSpec.
 */
function buildToolSpec(schema: z.ZodSchema, toolName = 'TestTool') {
  const tool = new StructuredOutputTool(schema, toolName, () => {})
  return tool.toolSpec
}

describe('StructuredOutputTool tool spec', () => {
  it('converts basic schema to tool spec', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const toolSpec = buildToolSpec(schema)

    expect(toolSpec.name).toBe('TestTool')
    expect(toolSpec.description).toContain('StructuredOutputTool')
    expect(toolSpec.inputSchema).toStrictEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name', 'age'],
      additionalProperties: false,
    })
  })

  it('includes schema description in tool spec', () => {
    const schema = z
      .object({
        name: z.string(),
      })
      .describe('A person object')

    const toolSpec = buildToolSpec(schema)

    expect(toolSpec.description).toContain('A person object')
  })

  it('accepts schema with basic validations', () => {
    const schema = z.object({
      name: z.string().min(1).max(100),
      age: z.number().int().positive(),
      email: z.string().email(),
    })

    const toolSpec = buildToolSpec(schema)

    expect(toolSpec.inputSchema).toMatchObject({
      type: 'object',
      properties: {
        name: {
          type: 'string',
          minLength: 1,
          maxLength: 100,
        },
        age: {
          type: 'integer',
        },
        email: {
          type: 'string',
          format: 'email',
        },
      },
      required: ['name', 'age', 'email'],
      additionalProperties: false,
    })
  })

  it('accepts nested schema', () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
        age: z.number(),
      }),
      items: z.array(z.string()),
    })

    const toolSpec = buildToolSpec(schema)

    expect(toolSpec.inputSchema).toStrictEqual({
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
          required: ['name', 'age'],
          additionalProperties: false,
        },
        items: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['user', 'items'],
      additionalProperties: false,
    })
  })

  it('accepts union types', () => {
    const schema = z.union([z.string(), z.number()])

    expect(() => buildToolSpec(schema)).not.toThrow()
  })

  it('accepts optional fields', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    })

    const toolSpec = buildToolSpec(schema)

    expect(toolSpec.inputSchema).toStrictEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
      additionalProperties: false,
    })
  })

  it('returns empty description when schema has none', () => {
    const schema = z.object({ name: z.string() })

    const toolSpec = buildToolSpec(schema)

    // Description should contain the standard prefix but no additional schema description
    expect(toolSpec.description).toBe(
      'IMPORTANT: This StructuredOutputTool should only be invoked as the last and final tool before returning the completed result to the caller. '
    )
  })

  it('includes description from _def', () => {
    const schema = z.object({ name: z.string() })
    ;(schema as any)._def.description = 'Description in _def'

    const toolSpec = buildToolSpec(schema)

    expect(toolSpec.description).toContain('Description in _def')
  })
})
