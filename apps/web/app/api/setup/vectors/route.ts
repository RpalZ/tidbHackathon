import { NextRequest, NextResponse } from 'next/server'
import { initializeTiDBVectors } from '@/lib/tidb-vector'

/**
 * API Route to setup TiDB Vector columns and indexes
 * 
 * Call this ONCE after running `prisma db push` to convert
 * the TEXT columns to proper VECTOR columns in TiDB
 * 
 * Usage: 
 * POST /api/setup/vectors
 * 
 * This will:
 * 1. Drop existing TEXT vector columns
 * 2. Create VECTOR(1536) columns 
 * 3. Add cosine similarity indexes
 * 4. Enable semantic search functionality
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Setting up TiDB vector infrastructure...')
    
    // Initialize TiDB vector support
    await initializeTiDBVectors()
    
    return NextResponse.json({
      success: true,
      message: '✅ TiDB Vector setup completed successfully!',
      details: {
        vectorColumns: 'Created VECTOR(1536) columns for Questions and File tables',
        indexes: 'Created cosine similarity indexes for optimal search performance',
        ready: 'System is now ready for vector embeddings and semantic search'
      }
    })
    
  } catch (error) {
    console.error('❌ Vector setup failed:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Vector setup failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      troubleshooting: {
        step1: 'Make sure you ran: npx prisma db push',
        step2: 'Ensure your TiDB instance supports Vector Search',
        step3: 'Check that TIDB_URL environment variable is correct'
      }
    }, { status: 500 })
  }
}

/**
 * GET endpoint to check vector setup status
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'TiDB Vector Setup Endpoint',
    usage: 'Send POST request to initialize vector columns and indexes',
    status: 'Ready to setup',
    requirements: [
      'Run `npx prisma db push` first',
      'Ensure TiDB instance supports Vector Search',
      'Valid TIDB_URL in environment variables'
    ]
  })
}
