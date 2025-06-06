
import {auth} from '@/lib/auth'
import { redirect } from "next/navigation";
import { UrlPreview } from './_components/url';
import { CardProfile } from './_components/card-profile';
import { Header } from '../_components/header';
export default async function Me() {
    
    const session = await auth();
    
    if (!session?.user) {
        redirect('/')
    }

    const userData = {
        id: session.user.id,
        name: session.user.name || null,
        username: session.user?.username || null,
        bio: session.user?.bio || null,
        email: session.user?.email || null,
        image: session.user?.image || null
    }    

    return (
        <main className="w-full h-full flex gap-4 flex-col items-center p-4">
            <div className='w-full'>
                <Header />
            </div>
            <section
                className="w-full flex lg:flex-row flex-col lg:items-center mx-auto bg-zinc-transparent rounded-md p-4 gap-2"
            >
                <UrlPreview username={userData.username}/>
            </section>
            <div className='w-full px-4'>
                <CardProfile user={userData} /> 
            </div>
        </main >
    )
}