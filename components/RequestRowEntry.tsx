import { RequestData } from "@/lib/types";
import { ClockIcon, DocumentIcon, XCircleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default function RequestRowEntry({ request, caseId }: { request: RequestData, caseId: string }) {
    return (
        <>
            <div key={request.id} className="row-span-2 place-self-center">
                {(() => {
                    const detailHref =
                        request.type === 'argument-builder'
                            ? `/cases/${caseId}/argument-builder/${request.id}`
                            : request.type === 'declaration'
                              ? `/cases/${caseId}/declarations/${request.id}`
                              : null;

                    if (request.status === 'failed') {
                        return <XCircleIcon className="h-12 w-12 md:h-20 md:w-20 text-red-500" />;
                    }

                    if (detailHref && request.status === 'completed') {
                        return (
                            <Link href={detailHref}>
                                <DocumentIcon className="h-12 w-12 md:h-20 md:w-20 text-green-500" />
                            </Link>
                        );
                    }

                    return <ClockIcon className="h-12 w-12 md:h-20 md:w-20 text-yellow-500" />;
                })()}
            </div>
            <div className="col-span-2">{request.status}</div>
            <div className="col-span-2">{new Date(request.startedAt).toLocaleString("en-US")}</div>
            <div className="col-span-2">{request.endedAt ? new Date(request.endedAt).toLocaleString("en-US") : "In Progress"}</div>
            <div className="col-span-6">{request.input}</div>
            <div className="col-span-7 border-b-1" />
        </>
    );
}