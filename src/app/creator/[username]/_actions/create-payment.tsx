"use server"

import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { stripe } from '@/lib/stripe'

const createUsernameSchema = z.object({
    slug: z.string().min(1, "O username precisa ter pelo menos 1 letra"),
    name: z.string().min(1, "O nome precisa ter pelo menos 1 letra"),
    message: z.string().min(5, "A mensagem precisa ter pelo menos 5 letras"),
    price: z.number().min(10, "O valor precisa ser maior que 10"),
    creatorId: z.string(),
})

type CreatePaymentSchema = z.infer<typeof createUsernameSchema>

export async function createPayment(data: CreatePaymentSchema) {
    const schema = createUsernameSchema.safeParse(data)

    if (!schema.success) {
        return {
            error: schema.error.issues[0].message
        }
    }

    if (!data.creatorId) {
        return {
            error: 'Criador Não Encontrado'
        }
    }

    try {
        const creator = await prisma.user.findFirst({
            where: {
                conectStipeAccountId: data.creatorId
            }
        })

        if (!creator) {
            return {
                error: 'Erro ao procurar o criador'
            }
        }

        // Verificar se a conta conectada está ativa
        const account = await stripe.accounts.retrieve(creator.conectStipeAccountId as string)
        
        if (!account.capabilities?.transfers || account.capabilities.transfers !== 'active') {
            return {
                error: 'A conta do criador ainda não está completamente verificada. Tente novamente mais tarde.'
            }
        }

        // Calcular taxa da aplicação (10%)
        const applicationFeeAmount = Math.floor(data.price * 0.1)

        const donation = await prisma.donation.create({
            data: {
                donorName: data.name,
                donorMessage: data.message,
                userId: creator.id,
                status: "PENDING",
                amount: data.price // Valor total, não descontado
            }
        })

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: 'payment',
            success_url: `${process.env.NEXT_PUBLIC_HOST_URL}/creator/${data.slug}?success=true`,
            cancel_url: `${process.env.NEXT_PUBLIC_HOST_URL}/creator/${data.slug}?canceled=true`,
            line_items: [
                {
                    price_data: {
                        currency: 'brl',
                        product_data: {
                            name: `Apoiar ${creator.name}`,
                        },
                        unit_amount: data.price,
                    },
                    quantity: 1,
                },
            ],
            payment_intent_data: {
                application_fee_amount: applicationFeeAmount,
                transfer_data: {
                    destination: creator.conectStipeAccountId as string
                },
                metadata: {
                    donorName: data.name,
                    donorMessage: data.message, // Corrigido o typo
                    donationId: donation.id,
                    creatorId: creator.id
                }
            },
        })

        return {
            sessionId: session.id,
        }

    } catch (error) {
        console.error('Erro detalhado:', error)
        
        // Tratamento específico para erros do Stripe
        //if (error.type === 'StripeInvalidRequestError') {if (error.code === 'insufficient_capabilities_for_transfer') {return {error: 'A conta do criador precisa completar a verificação no Stripe antes de receber doações.'}}}
        
        return {
            error: 'Erro ao criar o pagamento. Tente novamente.'
        }
    }
}