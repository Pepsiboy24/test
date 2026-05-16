import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// Monnify API configuration
const MONNIFY_API_URL = 'https://api.monnify.com/api/v2'
// In production, these should be stored as Deno secrets
const MONNIFY_API_KEY = Deno.env.get('MONNIFY_API_KEY') || 'mk_test_YOUR_API_KEY_HERE'
const MONNIFY_SECRET_KEY = Deno.env.get('MONNIFY_SECRET_KEY') || 'YOUR_SECRET_KEY_HERE'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    const { schoolName, schoolId, bankName, accountNumber, bankCode, splitCode, commissionRate } = await req.json()

    // Validate required fields
    if (!schoolName || !schoolId || !bankName || !accountNumber) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: schoolName, schoolId, bankName, accountNumber'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create sub-account on Monnify
    const subAccountData = await createMonnifySubAccount({
      businessName: schoolName,
      accountBank: bankName,
      accountNumber: accountNumber,
      bankCode: bankCode,
      splitCode: splitCode,
      commissionRate: commissionRate || 1.5
    })

    if (!subAccountData.success) {
      return new Response(
        JSON.stringify({
          error: 'Failed to create Monnify sub-account',
          details: subAccountData.error
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Store sub-account details in database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { error: updateError } = await supabase
      .from('Schools')
      .update({
        monnify_sub_account_code: subAccountData.subAccountCode,
        monnify_api_key: subAccountData.apiKey,
        monnify_contract_code: subAccountData.contractCode
      })
      .eq('school_id', schoolId)

    if (updateError) {
      console.error('Failed to update school with Monnify details:', updateError)
      // Don't fail the request if update fails, but log it
    }

    return new Response(
      JSON.stringify({
        success: true,
        subAccountCode: subAccountData.subAccountCode,
        apiKey: subAccountData.apiKey,
        contractCode: subAccountData.contractCode,
        message: 'Monnify sub-account created successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function createMonnifySubAccount(data: {
  businessName: string
  accountBank: string
  accountNumber: string
  bankCode?: string
  splitCode?: string
  commissionRate?: number
}) {
  try {
    // Step 1: Create reserved account
    const reservedResponse = await fetch(`${MONNIFY_API_URL}/bank-transfer/reserved-accounts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MONNIFY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accountReference: `SCHOOL_${Date.now()}`,
        accountName: data.businessName,
        customerEmail: `admin@${data.businessName.toLowerCase().replace(/\s+/g, '')}.com`,
        customerName: data.businessName,
        bvn: null, // Optional
        currencyCode: 'NGN', // Nigerian Naira
        contractCode: null, // Will be generated
        getAllAvailableBanks: false
      })
    })

    if (!reservedResponse.ok) {
      const error = await reservedResponse.json()
      return {
        success: false,
        error: `Failed to create reserved account: ${error.message || 'Unknown error'}`
      }
    }

    const reservedData = await reservedResponse.json()

    if (!reservedData.requestSuccessful) {
      return {
        success: false,
        error: reservedData.responseMessage || 'Failed to create reserved account'
      }
    }

    // Step 2: Activate the reserved account
    const activateResponse = await fetch(`${MONNIFY_API_URL}/bank-transfer/reserved-accounts/activate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MONNIFY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accountReference: reservedData.responseBody.accountReference,
        currencyCode: 'NGN',
        contractCode: reservedData.responseBody.contractCode
      })
    })

    if (!activateResponse.ok) {
      const error = await activateResponse.json()
      return {
        success: false,
        error: `Failed to activate account: ${error.message || 'Unknown error'}`
      }
    }

    const activateData = await activateResponse.json()

    if (!activateData.requestSuccessful) {
      return {
        success: false,
        error: activateData.responseMessage || 'Failed to activate account'
      }
    }

    // Step 3: Create split payment configuration if commission rate is provided
    let splitConfig = null
    if (data.commissionRate && data.commissionRate > 0) {
      const splitResponse = await fetch(`${MONNIFY_API_URL}/sub-accounts/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MONNIFY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accountName: `${data.businessName} Revenue`,
          accountBank: data.accountBank,
          accountNumber: data.accountNumber,
          bankCode: data.bankCode,
          currencyCode: 'NGN',
          splitPercentage: data.commissionRate,
          primaryAccountEmail: `admin@${data.businessName.toLowerCase().replace(/\s+/g, '')}.com`,
          primarySplitPercentage: 100 - (data.commissionRate || 0)
        })
      })

      if (splitResponse.ok) {
        const splitData = await splitResponse.json()
        if (splitData.requestSuccessful) {
          splitConfig = {
            subAccountCode: splitData.responseBody.subAccountCode,
            apiKey: splitData.responseBody.apiKey
          }
        }
      }
    }

    return {
      success: true,
      subAccountCode: activateData.responseBody.accountNumber,
      apiKey: MONNIFY_SECRET_KEY, // In production, generate a unique key
      contractCode: activateData.responseBody.contractCode,
      splitConfig
    }

  } catch (error) {
    console.error('Monnify API error:', error)
    return {
      success: false,
      error: error.message || 'Failed to create Monnify sub-account'
    }
  }
}
