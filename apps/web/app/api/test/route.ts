import {NextRequest, NextResponse} from "next/server"
import { auth } from "@/lib/auth"
import { getSession } from "next-auth/react"
import { User } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
    const user = await auth()
    // const userSession = await getSession()
    // console.log(userSession)
    console.log(user)
    const user1 : User = await prisma.user.findUnique({
        where: { email: user?.user?.email! },
      }) as unknown as User;
    return NextResponse.json({ message: `Hello, ${user1.id}!` })
}