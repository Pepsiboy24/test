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
    const { studentId, studentName, schoolId, parentEmail } = await req.json()

    // Validate required fields
    if (!studentId || !studentName || !schoolId) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: studentId, studentName, schoolId'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get school's Monnify configuration
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { data: school, error: schoolError } = await supabase
      .from('Schools')
      .select('monnify_contract_code, monnify_api_key')
      .eq('school_id', schoolId)
      .single()

    if (schoolError || !school) {
      return new Response(
        JSON.stringify({
          error: 'School not found or missing Monnify configuration',
          details: schoolError?.message
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Reserved Account for student
    const accountData = await createStudentReservedAccount({
      studentId,
      studentName,
      contractCode: school.monnify_contract_code,
      parentEmail: parentEmail || `parent-${studentId}@edtech.com`,
      schoolApiKey: school.monnify_api_key
    })

    if (!accountData.success) {
      return new Response(
        JSON.stringify({
          error: 'Failed to create student virtual account',
          details: accountData.error
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Store virtual account details in database
    const { error: insertError } = await supabase
      .from('Student_Virtual_Accounts')
      .insert([{
        student_id: studentId,
        account_number: accountData.accountNumber,
        account_name: accountData.accountName,
        bank_name: accountData.bankName,
        bank_code: accountData.bankCode,
        reservation_reference: accountData.reservationReference,
        contract_code: accountData.contractCode,
        account_status: 'ACTIVE',
        created_at: new Date().toISOString()
      }])

    if (insertError) {
      console.error('Failed to store virtual account details:', insertError)
      // Don't fail the request if insert fails, but log it
    }

    return new Response(
      JSON.stringify({
        success: true,
        accountNumber: accountData.accountNumber,
        accountName: accountData.accountName,
        bankName: accountData.bankName,
        bankCode: accountData.bankCode,
        message: 'Student virtual account created successfully'
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

async function createStudentReservedAccount(data: {
  studentId: string
  studentName: string
  contractCode: string
  parentEmail: string
  schoolApiKey: string
}) {
  try {
    // Create reserved account for student
    const response = await fetch(`${MONNIFY_API_URL}/bank-transfer/reserved-accounts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MONNIFY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accountReference: `STUDENT_${data.studentId}_${Date.now()}`,
        accountName: `${data.studentName} - School Fees`,
        customerEmail: data.parentEmail,
        customerName: data.studentName,
        bvn: null, // Optional for students
        currencyCode: 'NGN', // Nigerian Naira
        contractCode: data.contractCode,
        getAllAvailableBanks: false,
        preferredBanks: ['035', // Wema Bank
          '011', // First Bank
          '058', // GTBank
          '033', // United Bank for Africa
          '023', // Citibank
          '050', // Ecobank
          '070', // Fidelity Bank
          '076', // Unity Bank
          '101', // Providus Bank
          '214', // FCMB
          '301', // Jaiz Bank
          '221', // Stanbic IBTC
          '082', // Polaris Bank
          '032', // Union Bank
          '072', // Zenith Bank
          '057', // Standard Chartered
          '215', // Keystone Bank
          '221'] // Heritage Bank
      })
    })

    if (!response.ok) {
      const error = await response.json()
      return {
        success: false,
        error: `Failed to create reserved account: ${error.message || 'Unknown error'}`
      }
    }

    const responseData = await response.json()

    if (!responseData.requestSuccessful) {
      return {
        success: false,
        error: responseData.responseMessage || 'Failed to create reserved account'
      }
    }

    const accountDetails = responseData.responseBody
    const accountInfo = accountDetails.accounts[0] // Get first available account

    return {
      success: true,
      accountNumber: accountInfo.accountNumber,
      accountName: accountInfo.accountName,
      bankName: accountInfo.bankName,
      bankCode: accountInfo.bankCode,
      reservationReference: accountDetails.reservationReference,
      contractCode: accountDetails.contractCode
    }

  } catch (error) {
    console.error('Monnify API error:', error)
    return {
      success: false,
      error: error.message || 'Failed to create student virtual account'
    }
  }
}
