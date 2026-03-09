import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { StructuredOutputTool } from '../tool.js'
import { TextBlock, ToolResultBlock } from '../../types/messages.js'
import type { ToolContext } from '../../tools/tool.js'

describe('StructuredOutputTool', () => {
  describe('constructor', () => {
    it('creates tool with schema and name', () => {
      const schema = z.object({ name: z.string() })
      const tool = new StructuredOutputTool(schema, 'TestTool', vi.fn())

      expect(tool.name).toBe('TestTool')
      expect(tool.description).toContain('StructuredOutputTool')
      expect(tool.toolSpec).toBeDefined()
    })

    it('sets tool spec from schema', () => {
      const schema = z.object({ name: z.string(), age: z.number() })
      const tool = new StructuredOutputTool(schema, 'TestTool', vi.fn())

      expect(tool.toolSpec.name).toBe('TestTool')
      expect(tool.toolSpec.inputSchema).toBeDefined()
    })
  })

  describe('stream', () => {
    it('validates and calls onResult with valid input', async () => {
      const schema = z.object({ name: z.string(), age: z.number() })
      const onResult = vi.fn()
      const tool = new StructuredOutputTool(schema, 'TestTool', onResult)

      const toolContext: ToolContext = {
        toolUse: {
          name: 'TestTool',
          toolUseId: 'tool-1',
          input: { name: 'John', age: 30 },
        },
        agent: {} as any,
      }

      const generator = tool.stream(toolContext)
      const result = await generator.next()

      expect(result.done).toBe(true)
      if (result.done) {
        expect(result.value).toBeInstanceOf(ToolResultBlock)
        expect(result.value.status).toBe('success')
        expect(result.value.toolUseId).toBe('tool-1')
        expect(onResult).toHaveBeenCalledWith({ name: 'John', age: 30 })
      }
    })

    it('returns error for invalid input', async () => {
      const schema = z.object({ name: z.string(), age: z.number() })
      const onResult = vi.fn()
      const tool = new StructuredOutputTool(schema, 'TestTool', onResult)

      const toolContext: ToolContext = {
        toolUse: {
          name: 'TestTool',
          toolUseId: 'tool-1',
          input: { name: 'John', age: 'invalid' },
        },
        agent: {} as any,
      }

      const generator = tool.stream(toolContext)
      const result = await generator.next()

      expect(result.done).toBe(true)
      if (result.done) {
        expect(result.value).toBeInstanceOf(ToolResultBlock)
        expect(result.value.status).toBe('error')
        expect(result.value.toolUseId).toBe('tool-1')
        expect(result.value.content[0]).toBeInstanceOf(TextBlock)
        expect((result.value.content[0] as TextBlock).text).toContain('Validation failed')
        expect((result.value.content[0] as TextBlock).text).toContain('age')
        expect(onResult).not.toHaveBeenCalled()
      }
    })

    it('returns formatted validation errors', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        email: z.string().email(),
      })
      const tool = new StructuredOutputTool(schema, 'TestTool', vi.fn())

      const toolContext: ToolContext = {
        toolUse: {
          name: 'TestTool',
          toolUseId: 'tool-1',
          input: { name: 123, age: 'invalid', email: 'not-email' },
        },
        agent: {} as any,
      }

      const generator = tool.stream(toolContext)
      const result = await generator.next()

      expect(result.done).toBe(true)
      if (result.done) {
        expect(result.value.status).toBe('error')
        const errorText = (result.value.content[0] as TextBlock).text
        expect(errorText).toContain("Field 'name':")
        expect(errorText).toContain("Field 'age':")
        expect(errorText).toContain("Field 'email':")
      }
    })

    it('validates nested objects', async () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          age: z.number(),
        }),
      })
      const onResult = vi.fn()
      const tool = new StructuredOutputTool(schema, 'TestTool', onResult)

      const toolContext: ToolContext = {
        toolUse: {
          name: 'TestTool',
          toolUseId: 'tool-1',
          input: { user: { name: 'John', age: 30 } },
        },
        agent: {} as any,
      }

      const generator = tool.stream(toolContext)
      const result = await generator.next()

      expect(result.done).toBe(true)
      if (result.done) {
        expect(result.value.status).toBe('success')
        expect(onResult).toHaveBeenCalledWith({ user: { name: 'John', age: 30 } })
      }
    })

    it('validates arrays', async () => {
      const schema = z.object({
        items: z.array(z.string()),
      })
      const onResult = vi.fn()
      const tool = new StructuredOutputTool(schema, 'TestTool', onResult)

      const toolContext: ToolContext = {
        toolUse: {
          name: 'TestTool',
          toolUseId: 'tool-1',
          input: { items: ['a', 'b', 'c'] },
        },
        agent: {} as any,
      }

      const generator = tool.stream(toolContext)
      const result = await generator.next()

      expect(result.done).toBe(true)
      if (result.done) {
        expect(result.value.status).toBe('success')
        expect(onResult).toHaveBeenCalledWith({ items: ['a', 'b', 'c'] })
      }
    })

    it('handles optional fields', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional(),
      })
      const onResult = vi.fn()
      const tool = new StructuredOutputTool(schema, 'TestTool', onResult)

      const toolContext: ToolContext = {
        toolUse: {
          name: 'TestTool',
          toolUseId: 'tool-1',
          input: { name: 'John' },
        },
        agent: {} as any,
      }

      const generator = tool.stream(toolContext)
      const result = await generator.next()

      expect(result.done).toBe(true)
      if (result.done) {
        expect(result.value.status).toBe('success')
        expect(onResult).toHaveBeenCalledWith({ name: 'John' })
      }
    })

    it('stores error in result block on validation failure', async () => {
      const schema = z.object({ name: z.string() })
      const tool = new StructuredOutputTool(schema, 'TestTool', vi.fn())

      const toolContext: ToolContext = {
        toolUse: {
          name: 'TestTool',
          toolUseId: 'tool-1',
          input: { name: 123 },
        },
        agent: {} as any,
      }

      const generator = tool.stream(toolContext)
      const result = await generator.next()

      expect(result.done).toBe(true)
      if (result.done) {
        expect(result.value.error).toBeDefined()
        expect(result.value.error).toBeInstanceOf(z.ZodError)
      }
    })

    it('overwrites previous result on multiple calls', async () => {
      const schema = z.object({ value: z.number() })
      const onResult = vi.fn()
      const tool = new StructuredOutputTool(schema, 'TestTool', onResult)

      // First call
      const toolContext1: ToolContext = {
        toolUse: {
          name: 'TestTool',
          toolUseId: 'tool-1',
          input: { value: 1 },
        },
        agent: {} as any,
      }

      const generator1 = tool.stream(toolContext1)
      await generator1.next()

      expect(onResult).toHaveBeenCalledWith({ value: 1 })

      // Second call
      const toolContext2: ToolContext = {
        toolUse: {
          name: 'TestTool',
          toolUseId: 'tool-2',
          input: { value: 2 },
        },
        agent: {} as any,
      }

      const generator2 = tool.stream(toolContext2)
      await generator2.next()

      expect(onResult).toHaveBeenCalledWith({ value: 2 })
      expect(onResult).toHaveBeenCalledTimes(2)
    })

    it('does not call onResult when validation fails', async () => {
      const schema = z.object({ value: z.number() })
      const onResult = vi.fn()
      const tool = new StructuredOutputTool(schema, 'TestTool', onResult)

      // First call succeeds
      const toolContext1: ToolContext = {
        toolUse: {
          name: 'TestTool',
          toolUseId: 'tool-1',
          input: { value: 1 },
        },
        agent: {} as any,
      }

      const generator1 = tool.stream(toolContext1)
      await generator1.next()

      expect(onResult).toHaveBeenCalledTimes(1)
      expect(onResult).toHaveBeenCalledWith({ value: 1 })

      // Second call fails
      const toolContext2: ToolContext = {
        toolUse: {
          name: 'TestTool',
          toolUseId: 'tool-2',
          input: { value: 'invalid' },
        },
        agent: {} as any,
      }

      const generator2 = tool.stream(toolContext2)
      const result = await generator2.next()

      expect(result.done).toBe(true)
      if (result.done) {
        expect(result.value.status).toBe('error')
      }
      // onResult should not have been called again
      expect(onResult).toHaveBeenCalledTimes(1)
    })
  })
})
