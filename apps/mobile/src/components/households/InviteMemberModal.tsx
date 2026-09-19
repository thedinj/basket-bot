import { IonButton, IonContent, IonInput, IonModal } from "@ionic/react";
import React, { useRef, useState } from "react";
import { useInviteMember } from "../../db/hooks";
import { EditorFooter } from "../shared/EditorFooter";
import { FormField } from "../shared/FormField";
import { ModalHeader } from "../shared/ModalHeader";

import "./Households.scss";

interface InviteMemberModalProps {
    householdId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

const InviteMemberModal: React.FC<InviteMemberModalProps> = ({ householdId, isOpen, onClose }) => {
    const [email, setEmail] = useState("");
    const emailInputRef = useRef<HTMLIonInputElement>(null);
    const inviteMember = useInviteMember();

    const canSubmit = !!householdId && !!email.trim() && !inviteMember.isPending;

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!householdId || !canSubmit) return;

        await inviteMember.mutateAsync({ householdId, email: email.trim() });
        setEmail("");
        onClose();
    };

    const handleClose = () => {
        setEmail("");
        onClose();
    };

    return (
        <IonModal
            isOpen={isOpen}
            onDidDismiss={handleClose}
            onDidPresent={() => emailInputRef.current?.setFocus()}
        >
            <ModalHeader title="Invite Member" onClose={handleClose} />
            <IonContent className="ion-padding">
                <form className="editor-form" onSubmit={handleSubmit}>
                    <FormField label="Email">
                        <div className="form-control">
                            <IonInput
                                ref={emailInputRef}
                                aria-label="Email"
                                type="email"
                                inputmode="email"
                                autocomplete="email"
                                enterkeyhint="send"
                                value={email}
                                onIonInput={(e) => setEmail(e.detail.value || "")}
                                placeholder="member@example.com"
                                required
                                disabled={inviteMember.isPending}
                            />
                        </div>
                    </FormField>
                </form>
            </IonContent>
            <EditorFooter>
                <IonButton
                    className="editor-form__submit"
                    expand="block"
                    onClick={() => handleSubmit()}
                    disabled={!canSubmit}
                >
                    {inviteMember.isPending ? "Sending..." : "Send Invitation"}
                </IonButton>
            </EditorFooter>
        </IonModal>
    );
};

export default InviteMemberModal;
