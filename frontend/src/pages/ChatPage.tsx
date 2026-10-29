import { useParams } from "react-router-dom";
import { ChatRoom } from "../components/ChatRoom";
import { PageTitle } from "../components/Feedback";
export function ChatPage() {
  const { id = "" } = useParams();
  return (
    <>
      <PageTitle title="Here, together">
        Listen kindly. Share only what feels comfortable.
      </PageTitle>
      <ChatRoom circleId={id} />
    </>
  );
}
