import { zodResolver } from "@hookform/resolvers/zod";
import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonSelect,
    IonSelectOption,
    IonText,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useInviteStoreCollaborator } from "../../db/hooks";

const inviteFormSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    role: z.enum(["owner", "editor"]),
});

type InviteFormData = z.infer<typeof inviteFormSchema>;

interface InviteStoreCollaboratorModalProps {
    isOpen: boolean;
    onDismiss: () => void;
    storeId: string;
}

export const InviteStoreCollaboratorModal: React.FC<InviteStoreCollaboratorModalProps> = ({
    isOpen,
    onDismiss,
    storeId,
}) => {
    const inviteCollaborator = useInviteStoreCollaborator();

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors, isValid },
    } = useForm<InviteFormData>({
        resolver: zodResolver(inviteFormSchema),
        mode: "onChange",
        defaultValues: {
            email: "",
            role: "editor",
        },
    });

    const onSubmit = async (data: InviteFormData) => {
        await inviteCollaborator.mutateAsync({
            storeId,
            email: data.email,
            role: data.role,
        });
        reset();
        onDismiss();
    };

    const handleDismiss = () => {
        reset();
        onDismiss();
    };

    return (
        <IonModal isOpen={isOpen} onDidDismiss={handleDismiss}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Invite Collaborator</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={handleDismiss}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                <form onSubmit={handleSubmit(onSubmit)}>
                    <IonList>
                        <Controller
                            name="email"
                            control={control}
                            render={({ field }) => (
                                <IonItem>
                                    <IonLabel position="stacked">Email Address</IonLabel>
                                    <IonInput
                                        type="email"
                                        value={field.value}
                                        placeholder="Enter email address"
                                        onIonInput={(e) => field.onChange(e.detail.value)}
                                        autocapitalize="off"
                                    />
                                </IonItem>
                            )}
                        />
                        {errors.email && (
                            <IonText color="danger">
                                <p style={{ fontSize: "12px", marginLeft: "16px" }}>
                                    {errors.email.message}
                                </p>
                            </IonText>
                        )}

                        <Controller
                            name="role"
                            control={control}
                            render={({ field }) => (
                                <IonItem>
                                    <IonLabel position="stacked">Role</IonLabel>
                                    <IonSelect
                                        value={field.value}
                                        onIonChange={(e) => field.onChange(e.detail.value)}
                                    >
                                        <IonSelectOption value="editor">Editor</IonSelectOption>
                                        <IonSelectOption value="owner">Owner</IonSelectOption>
                                    </IonSelect>
                                </IonItem>
                            )}
                        />
                    </IonList>

                    <IonButton
                        expand="block"
                        type="submit"
                        disabled={!isValid || inviteCollaborator.isPending}
                        style={{ marginTop: "20px" }}
                    >
                        {inviteCollaborator.isPending ? "Sending..." : "Send Invitation"}
                    </IonButton>
                </form>

                <IonText color="medium">
                    <p style={{ fontSize: "14px", marginTop: "16px" }}>
                        <strong>Editor:</strong> Can view, edit items, and invite others
                        <br />
                        <strong>Owner:</strong> Can do everything editors can, plus manage
                        collaborators and delete the store
                    </p>
                </IonText>
            </IonContent>
        </IonModal>
    );
};
